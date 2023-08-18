import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
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
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps) => {
			const note = await this.prismaService.client.note.findUnique({
				where: { id: ps.noteId },
			});
			if (note === null) {
				throw new ApiError(meta.errors.noSuchNote);
			}

			try {
				await this.prismaService.client.promo_note.create({
					data: {
						noteId: note.id,
						expiresAt: new Date(ps.expiresAt),
						userId: note.userId,
					},
				});
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2002') {
						throw new ApiError(meta.errors.alreadyPromoted);
					}
				}

				throw e;
			}
		});
	}
}
