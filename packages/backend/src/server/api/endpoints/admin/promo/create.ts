import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: 'ee449fbe-af2a-453b-9cae-cf2fe7c895fc',
		},
		alreadyPromoted: {
			message: 'The note has already promoted.',
			code: 'ALREADY_PROMOTED',
			id: 'ae427aa2-7a41-484f-a18c-2c1104051604',
		},
	},
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
	expiresAt: z.number().int(),
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
		super(meta, paramDef, async (ps) => {
			const note = await this.getterService.getNote(ps.noteId).catch((e) => {
				if (e.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw e;
			});

			const exist =
				(await this.prismaService.client.promo_note.count({
					where: { noteId: note.id },
					take: 1,
				})) > 0;

			if (exist) {
				throw new ApiError(meta.errors.alreadyPromoted);
			}

			await this.prismaService.client.promo_note.create({
				data: {
					noteId: note.id,
					expiresAt: new Date(ps.expiresAt),
					userId: note.userId,
				},
			});
		});
	}
}
