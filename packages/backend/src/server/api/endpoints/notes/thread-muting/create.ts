import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { noSuchNote________________ } from '@/server/api/errors.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { NoteReadService } from '@/core/NoteReadService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['notes'],
	requireCredential: true,
	kind: 'write:account',
	limit: {
		duration: ms('1hour'),
		max: 10,
	},
	errors: { noSuchNote: noSuchNote________________ },
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
		private readonly noteReadService: NoteReadService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			const mutedNotes = await this.prismaService.client.note.findMany({
				where: {
					OR: [
						{ id: note.threadId ?? note.id },
						{ threadId: note.threadId ?? note.id },
					],
				},
			});

			await this.noteReadService.read(me.id, mutedNotes);

			await this.prismaService.client.noteThreadMuting.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					threadId: note.threadId ?? note.id,
					userId: me.id,
				},
			});
		});
	}
}
