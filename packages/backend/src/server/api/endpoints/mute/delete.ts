import { z } from 'zod';
import { Injectable } from '@nestjs/common';
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
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'b851d00b-8ab1-4a56-8b1b-e24187cb48ef',
		},
		muteeIsYourself: {
			message: 'Mutee is yourself.',
			code: 'MUTEE_IS_YOURSELF',
			id: 'f428b029-6b39-4d48-a1d2-cc1ae6dd5cf9',
		},
		notMuting: {
			message: 'You are not muting that user.',
			code: 'NOT_MUTING',
			id: '5467d020-daa9-4553-81e1-135c0c35a96d',
		},
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
			const exist = await this.prismaService.client.muting.findUnique({
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
