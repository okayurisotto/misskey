import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['account', 'notes', 'clips'],
	requireCredential: false,
	kind: 'read:account',
	errors: {
		noSuchClip: {
			message: 'No such clip.',
			code: 'NO_SUCH_CLIP',
			id: '1d7645e6-2b6d-4635-b0fe-fe22b0e72e00',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	clipId: MisskeyIdSchema,
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
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
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const clip = await this.prismaService.client.clip.findUnique({
				where: { id: ps.clipId },
			});

			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			if (!clip.isPublic && (me == null || clip.userId !== me.id)) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});
			const clipNotes = await this.prismaService.client.clip_note.findMany({
				where: {
					AND: [
						{ clipId: clip.id },
						{
							note: {
								AND: [
									paginationQuery.where,
									...(me
										? [
												this.prismaQueryService.getVisibilityWhereForNote(me.id),
												await this.prismaQueryService.getMutingWhereForNote(me.id),
												this.prismaQueryService.getBlockedWhereForNote(me.id),
										  ]
										: []),
								],
							},
						},
					],
				},
				include: { note: true },
				orderBy: { note: paginationQuery.orderBy },
				take: ps.limit,
			});

			return (await this.noteEntityService.packMany(
				clipNotes.map((clipNote) => clipNote.note),
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
