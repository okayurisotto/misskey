import { Injectable } from '@nestjs/common';
import type { LocalUser } from '@/models/entities/User.js';
import isNativeToken from '@/misc/is-native-token.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import type { AccessToken } from '@prisma/client';

export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AuthenticationError';
	}
}

@Injectable()
export class AuthenticateService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async authenticate(
		token: string | null | undefined,
	): Promise<[LocalUser | null, AccessToken | null]> {
		if (token == null) {
			return [null, null];
		}

		if (isNativeToken(token)) {
			const user = await this.prismaService.client.user.findUnique({
				where: { token },
			});

			if (user == null) {
				throw new AuthenticationError('user not found');
			}

			if (this.userEntityUtilService.isLocalUser(user)) {
				return [user, null];
			} else {
				throw new Error();
			}
		} else {
			const accessToken =
				await this.prismaService.client.accessToken.findFirst({
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

			this.prismaService.client.accessToken.update({
				where: { id: accessToken.id },
				data: { lastUsedAt: new Date() },
			});

			const user = await (async (id): Promise<LocalUser | null> => {
				const result = await this.prismaService.client.user.findUnique({
					where: { id },
				});
				if (result === null) return null;

				if (this.userEntityUtilService.isLocalUser(result)) {
					return result;
				} else {
					throw new Error();
				}
			})(accessToken.userId);

			if (accessToken.appId) {
				const app = await this.prismaService.client.app.findUniqueOrThrow({
					where: { id: accessToken.appId },
				});

				return [
					user,
					{
						id: accessToken.id,
						permission: app.permission,
					} as AccessToken,
				];
			} else {
				return [user, accessToken];
			}
		}
	}
}
