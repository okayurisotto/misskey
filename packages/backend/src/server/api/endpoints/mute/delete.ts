import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	noSuchUser______________,
	muteeIsYourself_,
	notMuting,
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
	kind: 'write:mutes',
	errors: {
		noSuchUser: noSuchUser______________,
		muteeIsYourself: muteeIsYourself_,
		notMuting: notMuting,
	},
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly userMutingService: UserMutingService,
		private readonly getterService: GetterService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const muter = me;

			// Check if the mutee is yourself
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

			// Check not muting
			const exist = await this.prismaService.client.userMuting.findUnique({
				where: {
					muterId_muteeId: {
						muterId: muter.id,
						muteeId: mutee.id,
					},
				},
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notMuting);
			}

			await this.userMutingService.unmute([exist]);
		});
	}
}
