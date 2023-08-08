import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import type { Note } from '@/models/entities/Note.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { T2P } from '@/types.js';
import type { note } from '@prisma/client';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: 'e1035875-9551-45ec-afa8-1ded1fcb53c8',
		},
	},
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
	limit: z.number().int().min(1).max(100).default(10),
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
		private readonly noteEntityService: NoteEntityService,
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

			const conversation: T2P<Note, note>[] = [];
			let i = 0;

			const get = async (id: any) => {
				i++;
				const p = await this.prismaService.client.note.findUnique({
					where: { id },
				});
				if (p == null) return;

				if (i > ps.offset!) {
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

			return (await this.noteEntityService.packMany(
				conversation,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
