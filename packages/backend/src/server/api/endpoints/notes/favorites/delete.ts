import { noSuchNote_________, notFavorited_ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['notes', 'favorites'],
	requireCredential: true,
	kind: 'write:favorites',
	errors: {noSuchNote:noSuchNote_________,notFavorited:notFavorited_},
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
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
			// Get favoritee
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			// if already favorited
			const exist = await this.prismaService.client.note_favorite.findUnique({
				where: {
					userId_noteId: {
						noteId: note.id,
						userId: me.id,
					},
				},
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notFavorited);
			}

			// Delete favorite
			await this.prismaService.client.note_favorite.delete({
				where: { id: exist.id },
			});
		});
	}
}
