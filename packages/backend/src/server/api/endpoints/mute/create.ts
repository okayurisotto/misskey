import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import {
	noSuchUser_____________,
	muteeIsYourself,
	alreadyMuting,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserMutingService } from '@/core/UserMutingService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:mutes',
	limit: {
		duration: ms('1hour'),
		max: 20,
	},
	errors: {
		noSuchUser: noSuchUser_____________,
		muteeIsYourself: muteeIsYourself,
		alreadyMuting: alreadyMuting,
	},
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
	expiresAt: z
		.number()
		.int()
		.nullable()
		.optional()
		.describe(
			'A Unix Epoch timestamp that must lie in the future. `null` means an indefinite mute.',
		),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly getterService: GetterService,
		private readonly userMutingService: UserMutingService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const muter = me;

			// 自分自身
			if (me.id === ps.userId) {
				throw new ApiError(meta.errors.muteeIsYourself);
			}

			// Get mutee
			const mutee = await this.getterService.getUser(ps.userId).catch((err) => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
					throw new ApiError(meta.errors.noSuchUser);
				}
				throw err;
			});

			// Check if already muting
			const exist =
				(await this.prismaService.client.userMuting.count({
					where: {
						muterId: muter.id,
						muteeId: mutee.id,
					},
					take: 1,
				})) > 0;

			if (exist) {
				throw new ApiError(meta.errors.alreadyMuting);
			}

			if (ps.expiresAt && ps.expiresAt <= Date.now()) {
				return;
			}

			await this.userMutingService.mute(
				muter,
				mutee,
				ps.expiresAt ? new Date(ps.expiresAt) : null,
			);
		});
	}
}
