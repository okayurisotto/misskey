import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { noSuchNote___________________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['notes'],
	requireCredential: true,
	kind: 'write:notes',
	limit: {
		duration: ms('1hour'),
		max: 300,
		minInterval: ms('1sec'),
	},
	errors: { noSuchNote: noSuchNote___________________ },
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
		private readonly noteDeleteService: NoteDeleteService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const renotes = await this.prismaService.client.note.findMany({
				where: { userId: me.id, renoteId: ps.noteId },
				include: { user: true },
			});

			await Promise.all(
				renotes.map(async (note) => {
					await this.noteDeleteService.delete(note.user, note);
				}),
			);
		});
	}
}
