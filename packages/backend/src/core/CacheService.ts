import { Injectable } from '@nestjs/common';
import { RedisKVCache } from '@/misc/cache/RedisKVCache.js';
import { MemoryKVCacheFC } from '@/misc/cache/MemoryKVCacheFC.js';
import type { LocalUser } from '@/models/entities/User.js';
import { StreamMessages } from '@/server/api/stream/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisService } from '@/core/RedisService.js';
import { RedisSubService } from '@/core/RedisSubService.js';
import { bindThis } from '@/decorators.js';
import { MemoryKVCacheF } from '@/misc/cache/MemoryKVCacheF.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { user, user_profile } from '@prisma/client';

@Injectable()
export class CacheService implements OnApplicationShutdown {
	public readonly userByIdCache;
	public readonly localUserByNativeTokenCache;
	public readonly localUserByIdCache;
	public readonly uriPersonCache;
	public readonly userProfileCache;
	public readonly userMutingsCache;
	public readonly userBlockingCache;
	/** 「被」Blockキャッシュ */
	public readonly userBlockedCache;
	public readonly renoteMutingsCache;
	public readonly userFollowingsCache;
	public readonly userFollowingChannelsCache;

	constructor(
		private readonly prismaService: PrismaService,
		private readonly redisClient: RedisService,
		private readonly redisForSub: RedisSubService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {
		/** 6h */
		const lifetime = 1000 * 60 * 60 * 6;

		this.localUserByIdCache = new MemoryKVCacheF<LocalUser | null>(
			lifetime,
			async (key) => {
				const result = await this.prismaService.client.user.findUnique({
					where: { id: key },
				});
				if (result === null) return null;

				if (this.userEntityUtilService.isLocalUser(result)) {
					return result;
				} else {
					throw new Error();
				}
			},
		);

		// ローカルユーザーならlocalUserByIdCacheにデータを追加し、こちらにはid(文字列)だけを追加する
		this.userByIdCache = new MemoryKVCacheFC<user | null, user | string | null>(
			lifetime,
			async (key) => {
				return await this.prismaService.client.user.findUnique({
					where: { id: key },
				});
			},
			{
				toCache: (user): user | string | null => {
					if (user === null) return null;

					if (this.userEntityUtilService.isLocalUser(user)) {
						this.localUserByIdCache.set(user.id, user);
						return user.id;
					} else {
						return user;
					}
				},
				fromCache: (userOrId): user | null | undefined => {
					if (typeof userOrId !== 'string') return userOrId;
					return this.localUserByIdCache.get(userOrId);
				},
			},
		);

		this.localUserByNativeTokenCache = new MemoryKVCacheFC<
			LocalUser | null,
			string | null
		>(
			null,
			async (key) => {
				return (await this.prismaService.client.user.findUnique({
					where: { token: key },
				})) as LocalUser | null;
			},
			{
				toCache: (user): string | null => {
					if (user === null) return null;
					this.localUserByIdCache.set(user.id, user);
					return user.id;
				},
				fromCache: (id): LocalUser | undefined | null => {
					if (id === null) return null;
					return this.localUserByIdCache.get(id);
				},
			},
		);

		this.uriPersonCache = new MemoryKVCacheFC<user | null, string | null>(
			null,
			async (key) => {
				return await this.prismaService.client.user.findFirst({
					where: { uri: key },
				});
			},
			{
				toCache: (user): string | null => {
					if (user === null) return null;
					this.userByIdCache.set(user.id, user);
					return user.id;
				},
				fromCache: (id): user | undefined | null => {
					if (id === null) return null;
					return this.userByIdCache.get(id);
				},
			},
		);

		this.userProfileCache = new RedisKVCache<user_profile>(
			this.redisClient,
			'userProfile',
			{
				lifetime: 1000 * 60 * 30, // 30m
				memoryCacheLifetime: 1000 * 60, // 1m
				fetcher: async (key): Promise<user_profile> => {
					return await this.prismaService.client.user_profile.findUniqueOrThrow(
						{
							where: { userId: key },
						},
					);
				},
				toRedisConverter: (value): string => JSON.stringify(value),
				fromRedisConverter: (value): user_profile => JSON.parse(value), // TODO: date型の考慮
			},
		);

		this.userMutingsCache = new RedisKVCache<Set<string>>(
			this.redisClient,
			'userMutings',
			{
				lifetime: 1000 * 60 * 30, // 30m
				memoryCacheLifetime: 1000 * 60, // 1m
				fetcher: async (key): Promise<Set<string>> => {
					const xs = await this.prismaService.client.userMuting.findMany({
						where: { muterId: key },
					});
					return new Set(xs.map((x) => x.muteeId));
				},
				toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
				fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
			},
		);

		this.userBlockingCache = new RedisKVCache<Set<string>>(
			this.redisClient,
			'userBlocking',
			{
				lifetime: 1000 * 60 * 30, // 30m
				memoryCacheLifetime: 1000 * 60, // 1m
				fetcher: async (key): Promise<Set<string>> => {
					const xs = await this.prismaService.client.blocking.findMany({
						where: { blockerId: key },
					});
					return new Set(xs.map((x) => x.blockeeId));
				},
				toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
				fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
			},
		);

		this.userBlockedCache = new RedisKVCache<Set<string>>(
			this.redisClient,
			'userBlocked',
			{
				lifetime: 1000 * 60 * 30, // 30m
				memoryCacheLifetime: 1000 * 60, // 1m
				fetcher: async (key): Promise<Set<string>> => {
					const xs = await this.prismaService.client.blocking.findMany({
						where: { blockeeId: key },
					});
					return new Set(xs.map((x) => x.blockerId));
				},
				toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
				fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
			},
		);

		this.renoteMutingsCache = new RedisKVCache<Set<string>>(
			this.redisClient,
			'renoteMutings',
			{
				lifetime: 1000 * 60 * 30, // 30m
				memoryCacheLifetime: 1000 * 60, // 1m
				fetcher: async (key): Promise<Set<string>> => {
					const xs = await this.prismaService.client.renote_muting.findMany({
						where: { muterId: key },
					});
					return new Set(xs.map((x) => x.muteeId));
				},
				toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
				fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
			},
		);

		this.userFollowingsCache = new RedisKVCache<Set<string>>(
			this.redisClient,
			'userFollowings',
			{
				lifetime: 1000 * 60 * 30, // 30m
				memoryCacheLifetime: 1000 * 60, // 1m
				fetcher: async (key): Promise<Set<string>> => {
					const xs = await this.prismaService.client.following.findMany({
						where: { followerId: key },
					});
					return new Set(xs.map((x) => x.followeeId));
				},
				toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
				fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
			},
		);

		this.userFollowingChannelsCache = new RedisKVCache<Set<string>>(
			this.redisClient,
			'userFollowingChannels',
			{
				lifetime: 1000 * 60 * 30, // 30m
				memoryCacheLifetime: 1000 * 60, // 1m
				fetcher: async (key): Promise<Set<string>> => {
					const xs = await this.prismaService.client.channelFollowing.findMany({
						where: { channelId: key },
					});
					return new Set(xs.map((x) => x.channelId));
				},
				toRedisConverter: (value): string => JSON.stringify(Array.from(value)),
				fromRedisConverter: (value): Set<string> => new Set(JSON.parse(value)),
			},
		);

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
				case 'userChangeSuspendedState':
				case 'remoteUserUpdated': {
					const user = await this.prismaService.client.user.findUniqueOrThrow({
						where: { id: body.id },
					});
					this.userByIdCache.set(user.id, user);
					for (const [k, v] of this.uriPersonCache.cache.cache.entries()) {
						if (v.value === user.id) {
							this.uriPersonCache.set(k, user);
						}
					}
					if (this.userEntityUtilService.isLocalUser(user)) {
						if (user.token === null) throw new Error();
						this.localUserByNativeTokenCache.set(user.token, user);
						this.localUserByIdCache.set(user.id, user);
					}
					break;
				}
				case 'userTokenRegenerated': {
					const user = (await this.prismaService.client.user.findUniqueOrThrow({
						where: { id: body.id },
					})) as LocalUser;
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

	public findUserById(userId: user['id']): Promise<user | null> {
		return this.userByIdCache.fetch(userId);
	}

	public dispose(): void {
		// eslint-disable-next-line @typescript-eslint/unbound-method
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

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
