import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { MemoryKVCache, RedisKVCache } from '@/misc/cache.js';
import type { LocalUser } from '@/models/entities/User.js';
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
			toMapConverter: (user): user | string => {
				if (user.host !== null) return user;
				localUserByIdCache.set(user.id, user as LocalUser);
				return user.id;
			},
			fromMapConverter: (userOrId): user | undefined => {
				if (typeof userOrId !== 'string') return userOrId;
				return localUserByIdCache.get(userOrId);
			},
		});
		this.userByIdCache = userByIdCache;

		this.localUserByNativeTokenCache = new MemoryKVCache<LocalUser | null, string | null>(Infinity, {
			toMapConverter: (user): string | null => {
				if (user === null) return null;
				localUserByIdCache.set(user.id, user);
				return user.id;
			},
			fromMapConverter: (id): LocalUser | undefined | null => {
				if (id === null) return null;
				return localUserByIdCache.get(id);
			},
		});

		this.uriPersonCache = new MemoryKVCache<user | null, string | null>(Infinity, {
			toMapConverter: (user): string | null => {
				if (user === null) return null;
				userByIdCache.set(user.id, user);
				return user.id;
			},
			fromMapConverter: (id): user | undefined | null => {
				if (id === null) return null;
				return userByIdCache.get(id);
			},
		});

		this.userProfileCache = new RedisKVCache<user_profile>(this.redisClient, 'userProfile', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: async (key): Promise<user_profile> => {
				return await this.prismaService.client.user_profile.findUniqueOrThrow({
					where: { userId: key },
				});
			},
			toRedisConverter: (value): string => JSON.stringify(value),
			fromRedisConverter: (value): user_profile => JSON.parse(value), // TODO: date型の考慮
		});

		this.userMutingsCache = new RedisKVCache<Set<string>>(this.redisClient, 'userMutings', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: async (key): Promise<Set<string>> => {
				const xs = await this.prismaService.client.muting.findMany({
					where: { muterId: key },
				});
				return new Set(xs.map(x => x.muteeId));
			},
			toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
		});

		this.userBlockingCache = new RedisKVCache<Set<string>>(this.redisClient, 'userBlocking', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: async (key): Promise<Set<string>> => {
				const xs = await this.prismaService.client.blocking.findMany({
					where: { blockerId: key },
				});
				return new Set(xs.map(x => x.blockeeId));
			},
			toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
		});

		this.userBlockedCache = new RedisKVCache<Set<string>>(this.redisClient, 'userBlocked', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: async (key): Promise<Set<string>> => {
				const xs = await this.prismaService.client.blocking.findMany({
					where: { blockeeId: key },
				});
				return new Set(xs.map(x => x.blockerId));
			},
			toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
		});

		this.renoteMutingsCache = new RedisKVCache<Set<string>>(this.redisClient, 'renoteMutings', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: async (key): Promise<Set<string>> => {
				const xs = await this.prismaService.client.renote_muting.findMany({
					where: { muterId: key },
				});
				return new Set(xs.map(x => x.muteeId));
			},
			toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
		});

		this.userFollowingsCache = new RedisKVCache<Set<string>>(this.redisClient, 'userFollowings', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: async (key): Promise<Set<string>> => {
				const xs = await this.prismaService.client.following.findMany({
					where: { followerId: key },
				});
				return new Set(xs.map(x => x.followeeId));
			},
			toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
		});

		this.userFollowingChannelsCache = new RedisKVCache<Set<string>>(this.redisClient, 'userFollowingChannels', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60, // 1m
			fetcher: async (key): Promise<Set<string>> => {
				const xs = await this.prismaService.client.channel_following.findMany({
					where: { followerId: key },
				});
				return new Set(xs.map(x => x.followeeId));
			},
			toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
			fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
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
						if (user.token === null) throw new Error();
						this.localUserByNativeTokenCache.set(user.token, user);
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
	public findUserById(userId: user['id']): Promise<user> {
		return this.userByIdCache.fetch(
			userId,
			() => this.prismaService.client.user.findUniqueOrThrow({ where: { id: userId } }),
		);
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
	public onApplicationShutdown(): void {
		this.dispose();
	}
}
