import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { RedisKVCache } from '@/misc/RedisKVCache.js';
import { IdService } from '@/core/IdService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisService } from '@/core/RedisService.js';
import type { Instance } from '@prisma/client';

@Injectable()
export class FederatedInstanceService implements OnApplicationShutdown {
	public federatedInstanceCache: RedisKVCache<Instance | null>;

	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly redisClient: RedisService,
		private readonly utilityService: UtilityService,
	) {
		this.federatedInstanceCache = new RedisKVCache<Instance | null>(
			this.redisClient,
			'federatedInstance',
			{
				lifetime: 1000 * 60 * 30, // 30m
				memoryCacheLifetime: 1000 * 60 * 3, // 3m
				fetcher: async (key): Promise<Instance | null> => {
					return await this.prismaService.client.instance.findUnique({
						where: { host: key },
					});
				},
				toRedisConverter: (value): string => JSON.stringify(value),
				fromRedisConverter: (value): Instance | null => {
					const parsed = JSON.parse(value);
					if (parsed == null) return null;
					return {
						...parsed,
						firstRetrievedAt: new Date(parsed.firstRetrievedAt),
						latestRequestReceivedAt: parsed.latestRequestReceivedAt
							? new Date(parsed.latestRequestReceivedAt)
							: null,
						infoUpdatedAt: parsed.infoUpdatedAt
							? new Date(parsed.infoUpdatedAt)
							: null,
					};
				},
			},
		);
	}

	public async fetch(host_: string): Promise<Instance> {
		const host = this.utilityService.toPuny(host_);

		const cached = await this.federatedInstanceCache.get(host);
		if (cached) return cached;

		const index = await this.prismaService.client.instance.findUnique({
			where: { host },
		});

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

	public async update(
		id: string,
		data: Partial<Instance>,
	): Promise<void> {
		const result = await this.prismaService.client.instance.update({
			where: { id },
			data,
		});

		this.federatedInstanceCache.set(result.host, result);
	}

	public dispose(): void {
		this.federatedInstanceCache.dispose();
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
