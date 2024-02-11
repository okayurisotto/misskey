import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { Note } from '@prisma/client';

const res = NoteSchema.array();
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
	limit: limit({ max: 100, default: 10 }),
	offset: z.number().int().default(0),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.prismaService.client.note.findUniqueOrThrow({
				where: { id: ps.noteId },
			});

			if (note.replyId === null) return [];

			const get = async (
				id: string,
				conversation: Note[] = [],
				depth = 0,
			): Promise<Note[]> => {
				const note = await this.prismaService.client.note.findUnique({
					where: { id },
				});
				if (note === null) {
					return conversation;
				}

				if (depth >= ps.offset) {
					conversation.push(note);
				}

				if (conversation.length === ps.limit) {
					return conversation;
				}

				if (note.replyId) {
					return await get(note.replyId, conversation, depth + 1);
				}

				return conversation;
			};

			const conversation = await get(note.replyId);
			return await this.noteEntityService.packMany(conversation, me);
		});
	}
}
