import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { MemoryKVCache, RedisKVCache } from '@/misc/cache.js';
import type { LocalUser, User } from '@/models/entities/User.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';
import { StreamMessages } from '@/server/api/stream/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { user, user_profile } from '@prisma/client';

@Injectable()
export class CacheService implements OnApplicationShutdown {
	public userByIdCache: MemoryKVCache<user, user | string>;
	public localUserByNativeTokenCache: MemoryKVCache<LocalUser | null, string | null>;
	public localUserByIdCache: MemoryKVCache<LocalUser>;
	public uriPersonCache: MemoryKVCache<user | null, string | null>;
	public userProfileCache: RedisKVCache<user_profile>;
	public userMutingsCache: RedisKVCache<Set<string>>;
	public userBlockingCache: RedisKVCache<Set<string>>;
	public userBlockedCache: RedisKVCache<Set<string>>; // NOTE: 「被」Blockキャッシュ
	public renoteMutingsCache: RedisKVCache<Set<string>>;
	public userFollowingsCache: RedisKVCache<Set<string>>;
	public userFollowingChannelsCache: RedisKVCache<Set<string>>;

	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,

		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {
		//this.onMessage = this.onMessage.bind(this);

		const localUserByIdCache = new MemoryKVCache<LocalUser>(1000 * 60 * 60 * 6 /* 6h */);
		this.localUserByIdCache	= localUserByIdCache;

		// ローカルユーザーならlocalUserByIdCacheにデータを追加し、こちらにはid(文字列)だけを追加する
		const userByIdCache = new MemoryKVCache<user, user | string>(1000 * 60 * 60 * 6 /* 6h */, {
			toMapConverter: user => {
				if (user.host === null) {
					localUserByIdCache.set(user.id, user as LocalUser);
					return user.id;
				}

				return user;
			},
			fromMapConverter: userOrId => typeof userOrId === 'string' ? localUserByIdCache.get(userOrId) : userOrId,
		});
		this.userByIdCache = userByIdCache;

		this.localUserByNativeTokenCache = new MemoryKVCache<LocalUser | null, string | null>(Infinity, {
			toMapConverter: user => {
				if (user === null) return null;

				localUserByIdCache.set(user.id, user);
				return user.id;
			},
			fromMapConverter: id => id === null ? null : localUserByIdCache.get(id),
		});
		this.uriPersonCache = new MemoryKVCache<user | null, string | null>(Infinity, {
			toMapConverter: user => {
				if (user === null) return null;

				userByIdCache.set(user.id, user);
				return user.id;
			},
			fromMapConverter: id => id === null ? null : userByIdCache.get(id),
		});

		this.userProfileCache = new RedisKVCache<user_profile>(this.redisClient, 'userProfile', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: (key) => this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: key } }),
			toRedisConverter: (value) => JSON.stringify(value),
			fromRedisConverter: (value) => JSON.parse(value), // TODO: date型の考慮
		});

		this.userMutingsCache = new RedisKVCache<Set<string>>(this.redisClient, 'userMutings', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: (key) => this.prismaService.client.muting.findMany({ where: { muterId: key } }).then(xs => new Set(xs.map(x => x.muteeId))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value) => new Set(JSON.parse(value)),
		});

		this.userBlockingCache = new RedisKVCache<Set<string>>(this.redisClient, 'userBlocking', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: (key) => this.prismaService.client.blocking.findMany({ where: { blockerId: key } }).then(xs => new Set(xs.map(x => x.blockeeId))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value) => new Set(JSON.parse(value)),
		});

		this.userBlockedCache = new RedisKVCache<Set<string>>(this.redisClient, 'userBlocked', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: (key) => this.prismaService.client.blocking.findMany({ where: { blockeeId: key } }).then(xs => new Set(xs.map(x => x.blockerId))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value) => new Set(JSON.parse(value)),
		});

		this.renoteMutingsCache = new RedisKVCache<Set<string>>(this.redisClient, 'renoteMutings', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: (key) => this.prismaService.client.renote_muting.findMany({ where: { muterId: key } }).then(xs => new Set(xs.map(x => x.muteeId))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value) => new Set(JSON.parse(value)),
		});

		this.userFollowingsCache = new RedisKVCache<Set<string>>(this.redisClient, 'userFollowings', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: (key) => this.prismaService.client.following.findMany({ where: { followerId: key } }).then(xs => new Set(xs.map(x => x.followeeId))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value) => new Set(JSON.parse(value)),
		});

		this.userFollowingChannelsCache = new RedisKVCache<Set<string>>(this.redisClient, 'userFollowingChannels', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: (key) => this.prismaService.client.channel_following.findMany({ where: { followerId: key } }).then(xs => new Set(xs.map(x => x.followeeId))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value) => new Set(JSON.parse(value)),
		});

		this.redisForSub.on('message', this.onMessage);
	}

	@bindThis
	private async onMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } = obj.message as StreamMessages['internal']['payload'];
			switch (type) {
				case 'userChangeSuspendedState':
				case 'remoteUserUpdated': {
					const user = await this.prismaService.client.user.findUniqueOrThrow({ where: { id: body.id } });
					this.userByIdCache.set(user.id, user);
					for (const [k, v] of this.uriPersonCache.cache.entries()) {
						if (v.value === user.id) {
							this.uriPersonCache.set(k, user);
						}
					}
					if (this.userEntityService.isLocalUser(user)) {
						this.localUserByNativeTokenCache.set(user.token!, user);
						this.localUserByIdCache.set(user.id, user);
					}
					break;
				}
				case 'userTokenRegenerated': {
					const user = await this.prismaService.client.user.findUniqueOrThrow({ where: { id: body.id } }) as LocalUser;
					this.localUserByNativeTokenCache.delete(body.oldToken);
					this.localUserByNativeTokenCache.set(body.newToken, user);
					break;
				}
				case 'follow': {
					const follower = this.userByIdCache.get(body.followerId);
					if (follower) follower.followingCount++;
					const followee = this.userByIdCache.get(body.followeeId);
					if (followee) followee.followersCount++;
					break;
				}
				default:
					break;
			}
		}
	}

	@bindThis
	public findUserById(userId: User['id']) {
		return this.userByIdCache.fetch(userId, () => this.prismaService.client.user.findUniqueOrThrow({ where: { id: userId } }));
	}

	@bindThis
	public dispose(): void {
		this.redisForSub.off('message', this.onMessage);
		this.userByIdCache.dispose();
		this.localUserByNativeTokenCache.dispose();
		this.localUserByIdCache.dispose();
		this.uriPersonCache.dispose();
		this.userProfileCache.dispose();
		this.userMutingsCache.dispose();
		this.userBlockingCache.dispose();
		this.userBlockedCache.dispose();
		this.renoteMutingsCache.dispose();
		this.userFollowingsCache.dispose();
		this.userFollowingChannelsCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
