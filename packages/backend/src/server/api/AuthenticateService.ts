import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { LocalUser } from '@/models/entities/User.js';
import type { AccessToken } from '@/models/entities/AccessToken.js';
import { MemoryKVCache } from '@/misc/cache.js';
import { CacheService } from '@/core/CacheService.js';
import isNativeToken from '@/misc/is-native-token.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { access_token, app } from '@prisma/client';
import { T2P } from '@/types.js';

export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AuthenticationError';
	}
}

@Injectable()
export class AuthenticateService implements OnApplicationShutdown {
	private appCache: MemoryKVCache<app>;

	constructor(
		private readonly cacheService: CacheService,
		private readonly prismaService: PrismaService,
	) {
		this.appCache = new MemoryKVCache<app>(Infinity);
	}

	@bindThis
	public async authenticate(token: string | null | undefined): Promise<[LocalUser | null, T2P<AccessToken, access_token> | null]> {
		if (token == null) {
			return [null, null];
		}

		if (isNativeToken(token)) {
			const user = await this.cacheService.localUserByNativeTokenCache.fetch(token,
				() => this.prismaService.client.user.findUnique({ where: { token } }) as Promise<LocalUser | null>);

			if (user == null) {
				throw new AuthenticationError('user not found');
			}

			return [user, null];
		} else {
			const accessToken = await this.prismaService.client.access_token.findFirst({
				where: {
					OR: [
						{ hash: token.toLowerCase() }, // app
						{ token: token }, // miauth
					]
				},
			});

			if (accessToken == null) {
				throw new AuthenticationError('invalid signature');
			}

			this.prismaService.client.access_token.update({
				where: { id: accessToken.id },
				data: { lastUsedAt: new Date() },
			});

			const user = await this.cacheService.localUserByIdCache.fetch(accessToken.userId,
				() => this.prismaService.client.user.findUnique({
					where: {
						id: accessToken.userId,
					},
				}) as Promise<LocalUser>);

			if (accessToken.appId) {
				const app = await this.appCache.fetch(
					accessToken.appId,
					() => this.prismaService.client.app.findUniqueOrThrow({ where: { id: accessToken.appId! } }),
				);

				return [user, {
					id: accessToken.id,
					permission: app.permission,
				} as access_token];
			} else {
				return [user, accessToken];
			}
		}
	}

	@bindThis
	public dispose(): void {
		this.appCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
