import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:mutes',
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '9b6728cf-638c-4aa1-bedb-e07d8101474d',
		},
		muteeIsYourself: {
			message: 'Mutee is yourself.',
			code: 'MUTEE_IS_YOURSELF',
			id: '619b1314-0850-4597-a242-e245f3da42af',
		},
		notMuting: {
			message: 'You are not muting that user.',
			code: 'NOT_MUTING',
			id: '2e4ef874-8bf0-4b4b-b069-4598f6d05817',
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
			const exist = await this.prismaService.client.renote_muting.findFirst({
				where: {
					muterId: muter.id,
					muteeId: mutee.id,
				},
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notMuting);
			}

			// Delete mute
			await this.prismaService.client.renote_muting.delete({
				where: { id: exist.id },
			});
		});
	}
}
