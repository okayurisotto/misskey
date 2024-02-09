import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchNote_________, notFavorited_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['notes', 'favorites'],
	requireCredential: true,
	kind: 'write:favorites',
	errors: { noSuchNote: noSuchNote_________, notFavorited: notFavorited_ },
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
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			await this.prismaService.client.noteFavorite.delete({
				where: { userId_noteId: { noteId: ps.noteId, userId: me.id } },
			});
		});
	}
}
