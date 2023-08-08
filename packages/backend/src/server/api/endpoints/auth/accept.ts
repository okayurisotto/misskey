import * as crypto from 'node:crypto';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['auth'],
	requireCredential: true,
	secure: true,
	errors: {
		noSuchSession: {
			message: 'No such session.',
			code: 'NO_SUCH_SESSION',
			id: '9c72d8de-391a-43c1-9d06-08d29efde8df',
		},
	},
} as const;

export const paramDef = z.object({
	token: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch token
			const session = await this.prismaService.client.auth_session.findFirst({
				where: { token: ps.token },
			});

			if (session == null) {
				throw new ApiError(meta.errors.noSuchSession);
			}

			const accessToken = secureRndstr(32);

			// Fetch exist access token
			const exist =
				(await this.prismaService.client.access_token.count({
					where: {
						appId: session.appId,
						userId: me.id,
					},
					take: 1,
				})) > 0;

			if (!exist) {
				const app = await this.prismaService.client.app.findUniqueOrThrow({
					where: { id: session.appId },
				});

				// Generate Hash
				const sha256 = crypto.createHash('sha256');
				sha256.update(accessToken + app.secret);
				const hash = sha256.digest('hex');

				const now = new Date();

				await this.prismaService.client.access_token.create({
					data: {
						id: this.idService.genId(),
						createdAt: now,
						lastUsedAt: now,
						appId: session.appId,
						userId: me.id,
						token: accessToken,
						hash: hash,
					},
				});
			}

			// Update session
			await this.prismaService.client.auth_session.update({
				where: { id: session.id },
				data: { userId: me.id },
			});
		});
	}
}
