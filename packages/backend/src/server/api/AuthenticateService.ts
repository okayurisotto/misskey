import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { LocalUser } from '@/models/entities/User.js';
import { CacheService } from '@/core/CacheService.js';
import isNativeToken from '@/misc/is-native-token.js';
import { PrismaService } from '@/core/PrismaService.js';
import { MemoryKVCacheF } from '@/misc/cache/MemoryKVCacheF.js';
import type { access_token, App } from '@prisma/client';

export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AuthenticationError';
	}
}

@Injectable()
export class AuthenticateService implements OnApplicationShutdown {
	private readonly appCache;

	constructor(
		private readonly cacheService: CacheService,
		private readonly prismaService: PrismaService,
	) {
		this.appCache = new MemoryKVCacheF<App>(null, async (key) => {
			return await this.prismaService.client.app.findUniqueOrThrow({
				where: { id: key },
			});
		});
	}

	public async authenticate(
		token: string | null | undefined,
	): Promise<[LocalUser | null, access_token | null]> {
		if (token == null) {
			return [null, null];
		}

		if (isNativeToken(token)) {
			const user =
				await this.cacheService.localUserByNativeTokenCache.fetch(token);

			if (user == null) {
				throw new AuthenticationError('user not found');
			}

			return [user, null];
		} else {
			const accessToken =
				await this.prismaService.client.access_token.findFirst({
					where: {
						OR: [
							{ hash: token.toLowerCase() }, // app
							{ token: token }, // miauth
						],
					},
				});

			if (accessToken == null) {
				throw new AuthenticationError('invalid signature');
			}

			this.prismaService.client.access_token.update({
				where: { id: accessToken.id },
				data: { lastUsedAt: new Date() },
			});

			const user = await this.cacheService.localUserByIdCache.fetch(
				accessToken.userId,
			);

			if (accessToken.appId) {
				const app = await this.appCache.fetch(accessToken.appId);

				return [
					user,
					{
						id: accessToken.id,
						permission: app.permission,
					} as access_token,
				];
			} else {
				return [user, accessToken];
			}
		}
	}

	public dispose(): void {
		this.appCache.dispose();
	}

	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
