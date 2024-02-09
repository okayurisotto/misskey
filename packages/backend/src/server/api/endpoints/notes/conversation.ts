import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchNote______ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';
import type { Note } from '@prisma/client';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
	errors: { noSuchNote: noSuchNote______ },
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
		private readonly getterService: GetterService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			const conversation: Note[] = [];
			let i = 0;

			const get = async (id: any): Promise<void> => {
				i++;
				const p = await this.prismaService.client.note.findUnique({
					where: { id },
				});
				if (p == null) return;

				if (i > ps.offset) {
					conversation.push(p);
				}

				if (conversation.length === ps.limit) {
					return;
				}

				if (p.replyId) {
					await get(p.replyId);
				}
			};

			if (note.replyId) {
				await get(note.replyId);
			}

			return await this.noteEntityService.packMany(conversation, me);
		});
	}
}
