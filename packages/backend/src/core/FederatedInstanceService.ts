import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import * as Redis from 'ioredis';
import { RedisKVCache } from '@/misc/cache.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { instance } from '@prisma/client';

@Injectable()
export class FederatedInstanceService implements OnApplicationShutdown {
	public federatedInstanceCache: RedisKVCache<instance | null>;

	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private readonly utilityService: UtilityService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		this.federatedInstanceCache = new RedisKVCache<instance | null>(this.redisClient, 'federatedInstance', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60 * 3, // 3m
			fetcher: async (key): Promise<instance | null> => {
				return await this.prismaService.client.instance.findUnique({
					where: { host: key },
				});
			},
			toRedisConverter: (value): string => JSON.stringify(value),
			fromRedisConverter: (value): instance | null => {
				const parsed = JSON.parse(value);
				if (parsed == null) return null;
				return {
					...parsed,
					firstRetrievedAt: new Date(parsed.firstRetrievedAt),
					latestRequestReceivedAt: parsed.latestRequestReceivedAt ? new Date(parsed.latestRequestReceivedAt) : null,
					infoUpdatedAt: parsed.infoUpdatedAt ? new Date(parsed.infoUpdatedAt) : null,
				};
			},
		});
	}

	@bindThis
	public async fetch(host_: string): Promise<instance> {
		const host = this.utilityService.toPuny(host_);

		const cached = await this.federatedInstanceCache.get(host);
		if (cached) return cached;

		const index = await this.prismaService.client.instance.findUnique({ where: { host } });

		if (index == null) {
			const i = await this.prismaService.client.instance.create({
				data: {
					id: this.idService.genId(),
					host,
					firstRetrievedAt: new Date(),
				},
			});

			this.federatedInstanceCache.set(host, i);
			return i;
		} else {
			this.federatedInstanceCache.set(host, index);
			return index;
		}
	}

	@bindThis
	public async update(id: instance['id'], data: Partial<instance>): Promise<void> {
		const result = await this.prismaService.client.instance.update({
			where: { id },
			data,
		});

		this.federatedInstanceCache.set(result.host, result);
	}

	@bindThis
	public dispose(): void {
		this.federatedInstanceCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(): void {
		this.dispose();
	}
}
