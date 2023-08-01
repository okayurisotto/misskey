import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RegistryItemsRepository } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	requireCredential: true,
	secure: true,
} as const;

const paramDef_ = z.object({
	key: z.string().min(1),
	value: z.unknown(),
	scope: z
		.array(z.string().regex(/^[a-zA-Z0-9_]+$/))
		.default([])
		.optional(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.registryItemsRepository)
		private registryItemsRepository: RegistryItemsRepository,

		private idService: IdService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.registryItemsRepository
				.createQueryBuilder('item')
				.where('item.domain IS NULL')
				.andWhere('item.userId = :userId', { userId: me.id })
				.andWhere('item.key = :key', { key: ps.key })
				.andWhere('item.scope = :scope', { scope: ps.scope });

			const existingItem = await query.getOne();

			if (existingItem) {
				await this.registryItemsRepository.update(existingItem.id, {
					updatedAt: new Date(),
					value: ps.value,
				});
			} else {
				await this.registryItemsRepository.insert({
					id: this.idService.genId(),
					createdAt: new Date(),
					updatedAt: new Date(),
					userId: me.id,
					domain: null,
					scope: ps.scope,
					key: ps.key,
					value: ps.value,
				});
			}

			// TODO: サードパーティアプリが傍受出来てしまうのでどうにかする
			this.globalEventService.publishMainStream(me.id, 'registryUpdated', {
				scope: ps.scope,
				key: ps.key,
				value: ps.value,
			});
		});
	}
}
