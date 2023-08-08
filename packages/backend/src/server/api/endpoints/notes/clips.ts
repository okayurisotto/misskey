import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(ClipSchema);
export const meta = {
	tags: ['clips', 'notes'],
	requireCredential: false,
	res,
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '47db1a1c-b0af-458d-8fb4-986e4efafe1e',
		},
	},
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly clipEntityService: ClipEntityService,
		private readonly getterService: GetterService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24')
					throw new ApiError(meta.errors.noSuchNote);
				throw err;
			});

			const clipNotes = await this.prismaService.client.clip_note.findMany({
				where: { noteId: note.id },
			});

			const clips = await this.prismaService.client.clip.findMany({
				where: {
					id: { in: clipNotes.map((x) => x.clipId) },
					isPublic: true,
				},
			});

			return (await Promise.all(
				clips.map((clip) => this.clipEntityService.pack(clip, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
