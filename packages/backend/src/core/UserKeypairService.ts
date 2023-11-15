import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { RedisKVCache } from '@/misc/cache.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisService } from '@/core/RedisService.js';
import type { user_keypair, user } from '@prisma/client';

@Injectable()
export class UserKeypairService implements OnApplicationShutdown {
	private cache: RedisKVCache<user_keypair>;

	constructor(
		private readonly redisClient: RedisService,

		private readonly prismaService: PrismaService,
	) {
		this.cache = new RedisKVCache<user_keypair>(this.redisClient, 'userKeypair', {
			lifetime: 1000 * 60 * 60 * 24, // 24h
			memoryCacheLifetime: Infinity,
			fetcher: async (key): Promise<user_keypair> => {
				return await this.prismaService.client.user_keypair.findUniqueOrThrow({
					where: { userId: key },
				});
			},
			toRedisConverter: (value): string => JSON.stringify(value),
			fromRedisConverter: (value): user_keypair => JSON.parse(value),
		});
	}

	@bindThis
	public async getUserKeypair(userId: user['id']): Promise<user_keypair> {
		return await this.cache.fetch(userId);
	}

	@bindThis
	public dispose(): void {
		this.cache.dispose();
	}

	@bindThis
	public onApplicationShutdown(): void {
		this.dispose();
	}
}
