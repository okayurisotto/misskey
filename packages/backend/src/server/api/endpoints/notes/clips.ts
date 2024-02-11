import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(ClipSchema);
export const meta = {
	tags: ['clips', 'notes'],
	requireCredential: false,
	res,
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
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.prismaService.client.note.findUniqueOrThrow({
				where: { id: ps.noteId },
				include: { clipNotes: { include: { clip: true } } },
			});

			const clips = note.clipNotes
				.flatMap((clipNote) => clipNote.clip)
				.filter((clip) => clip.isPublic);

			return await Promise.all(
				clips.map((clip) => this.clipEntityService.pack(clip, me)),
			);
		});
	}
}
