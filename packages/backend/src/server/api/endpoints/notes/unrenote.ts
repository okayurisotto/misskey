import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { noSuchNote___________________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

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
		private readonly getterService: GetterService,
		private readonly noteDeleteService: NoteDeleteService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			const renotes = await this.prismaService.client.note.findMany({
				where: {
					userId: me.id,
					renoteId: note.id,
				},
			});

			for (const note of renotes) {
				this.noteDeleteService.delete(
					await this.prismaService.client.user.findUniqueOrThrow({
						where: { id: me.id },
					}),
					note,
				);
			}
		});
	}
}
