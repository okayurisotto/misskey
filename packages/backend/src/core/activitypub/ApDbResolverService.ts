import { Injectable } from '@nestjs/common';
import { CacheService } from '@/core/CacheService.js';
import { RemoteUser } from '@/models/entities/User.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApPersonResolveService } from './models/ApPersonResolveService.js';
import { ApDbResolverCacheService } from './ApDbResolverCacheService.js';
import type { user_publickey } from '@prisma/client';

@Injectable()
export class ApDbResolverService {
	constructor(
		private readonly apDbResolverCacheService: ApDbResolverCacheService,
		private readonly apPersonResolveService: ApPersonResolveService,
		private readonly cacheService: CacheService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * AP KeyId => Misskey User and Key
	 */
	public async getAuthUserFromKeyId(keyId: string): Promise<{
		user: RemoteUser;
		key: user_publickey;
	} | null> {
		const key = await this.apDbResolverCacheService.publicKeyCache.fetch(
			keyId,
			async () => {
				const key = await this.prismaService.client.user_publickey.findUnique({
					where: { keyId },
				});

				if (key == null) return null;

				return key;
			},
			(key) => key != null,
		);

		if (key == null) return null;

		return {
			user: (await this.cacheService.findUserById(key.userId)) as RemoteUser,
			key,
		};
	}

	/**
	 * AP Actor id => Misskey User and Key
	 */
	public async getAuthUserFromApId(uri: string): Promise<{
		user: RemoteUser;
		key: user_publickey | null;
	} | null> {
		const user = (await this.apPersonResolveService.resolve(uri)) as RemoteUser;

		const key =
			await this.apDbResolverCacheService.publicKeyByUserIdCache.fetch(
				user.id,
				() =>
					this.prismaService.client.user_publickey.findUnique({
						where: { userId: user.id },
					}),
				(v) => v != null,
			);

		return {
			user,
			key,
		};
	}
}
