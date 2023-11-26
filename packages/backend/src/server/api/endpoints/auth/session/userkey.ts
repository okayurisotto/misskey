import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	noSuchApp__,
	noSuchSession__,
	pendingSession,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = z.object({
	accessToken: z.string(),
	user: UserDetailedNotMeSchema,
});
export const meta = {
	tags: ['auth'],
	requireCredential: false,
	res,
	errors: {
		noSuchApp: noSuchApp__,
		noSuchSession: noSuchSession__,
		pendingSession: pendingSession,
	},
} as const;

export const paramDef = z.object({
	appSecret: z.string(),
	token: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			// Lookup app
			const app = await this.prismaService.client.app.findFirst({
				where: { secret: ps.appSecret },
			});

			if (app === null) {
				throw new ApiError(meta.errors.noSuchApp);
			}

			// Fetch token
			const session = await this.prismaService.client.authSession.findFirst({
				where: {
					token: ps.token,
					appId: app.id,
				},
				include: { user: true },
			});

			if (session === null) {
				throw new ApiError(meta.errors.noSuchSession);
			}

			if (session.user === null) {
				throw new ApiError(meta.errors.pendingSession);
			}

			// Lookup access token
			const accessToken =
				await this.prismaService.client.access_token.findFirstOrThrow({
					where: {
						appId: app.id,
						userId: session.user.id,
					},
				});

			// Delete session
			await this.prismaService.client.authSession.delete({
				where: { id: session.id },
			});

			return {
				accessToken: accessToken.token,
				user: await this.userEntityService.packDetailed(session.user, null),
			};
		});
	}
}
