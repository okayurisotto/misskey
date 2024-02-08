import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { NODE_ENV } from '@/env.js';
import { Meta as MetaEntity } from '@/models/entities/Meta.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { StreamMessages } from '@/server/api/stream/types.js';
import { RedisSubService } from '@/core/RedisSubService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import { bindThis } from '@/decorators.js';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { Meta } from '@prisma/client';

@Injectable()
export class MetaService implements OnApplicationShutdown {
	private cache: Meta | undefined;
	private readonly intervalId: NodeJS.Timer;

	constructor(
		private readonly db: TypeORMService,
		private readonly globalEventService: GlobalEventService,
		private readonly redisForSub: RedisSubService,
	) {
		//this.onMessage = this.onMessage.bind(this);

		if (NODE_ENV !== 'test') {
			this.intervalId = setInterval(
				() => {
					this.fetch(true).then((meta) => {
						// fetch内でもセットしてるけど仕様変更の可能性もあるため一応
						this.cache = meta;
					});
				},
				1000 * 60 * 5,
			);
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.redisForSub.on('message', this.onMessage);
	}

	@bindThis
	private async onMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } =
				obj.message as StreamMessages['internal']['payload'];
			switch (type) {
				case 'metaUpdated': {
					this.cache = body;
					break;
				}
				default:
					break;
			}
		}
	}

	public async fetch(noCache = false): Promise<Meta> {
		if (!noCache && this.cache) return this.cache;

		return await this.db.transaction(async (transactionalEntityManager) => {
			// 過去のバグでレコードが複数出来てしまっている可能性があるので新しいIDを優先する
			const metas = await transactionalEntityManager.find(MetaEntity, {
				order: {
					id: 'DESC',
				},
			});

			const meta = metas[0];

			if (meta) {
				this.cache = meta;
				return meta;
			} else {
				// metaが空のときfetchMetaが同時に呼ばれるとここが同時に呼ばれてしまうことがあるのでフェイルセーフなupsertを使う
				const saved = await transactionalEntityManager
					.upsert(
						MetaEntity,
						{
							id: 'x',
						},
						['id'],
					)
					.then((x) =>
						transactionalEntityManager.findOneByOrFail(MetaEntity, x.identifiers[0]),
					);

				this.cache = saved;
				return saved;
			}
		});
	}

	public async update(data: Partial<Meta>): Promise<MetaEntity> {
		const updated = await this.db.transaction(
			async (transactionalEntityManager) => {
				const metas = await transactionalEntityManager.find(MetaEntity, {
					order: {
						id: 'DESC',
					},
				});

				const meta = metas[0];

				if (meta) {
					await transactionalEntityManager.update(MetaEntity, meta.id, {
						...data,
						policies: z
							.record(z.string(), z.any())
							.optional()
							.parse(data.policies),
					});

					const metas = await transactionalEntityManager.find(MetaEntity, {
						order: {
							id: 'DESC',
						},
					});

					return metas[0];
				} else {
					return await transactionalEntityManager.save(MetaEntity, {
						...data,
						policies: z
							.record(z.string(), z.any())
							.optional()
							.parse(data.policies),
					});
				}
			},
		);

		this.globalEventService.publishInternalEvent('metaUpdated', updated);

		return updated;
	}

	public dispose(): void {
		clearInterval(this.intervalId);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.redisForSub.off('message', this.onMessage);
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
