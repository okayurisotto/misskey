import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import * as Redis from 'ioredis';
import type { User } from '@/models/entities/User.js';
import { RedisKVCache } from '@/misc/cache.js';
import type { UserKeypair } from '@/models/entities/UserKeypair.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user_keypair } from '@prisma/client';

@Injectable()
export class UserKeypairService implements OnApplicationShutdown {
	private cache: RedisKVCache<T2P<UserKeypair, user_keypair>>;

	constructor(
		@Inject(DI.redis)
		private readonly redisClient: Redis.Redis,

		private readonly prismaService: PrismaService,
	) {
		this.cache = new RedisKVCache<T2P<UserKeypair, user_keypair>>(this.redisClient, 'userKeypair', {
			lifetime: 1000 * 60 * 60 * 24, // 24h
			memoryCacheLifetime: Infinity,
			fetcher: (key) => this.prismaService.client.user_keypair.findUniqueOrThrow({ where: { userId: key } }),
			toRedisConverter: (value) => JSON.stringify(value),
			fromRedisConverter: (value) => JSON.parse(value),
		});
	}

	@bindThis
	public async getUserKeypair(userId: User['id']): Promise<T2P<UserKeypair, user_keypair>> {
		return await this.cache.fetch(userId);
	}

	@bindThis
	public dispose(): void {
		this.cache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
