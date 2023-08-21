import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	offset: z.number().int().default(0),
	channelId: MisskeyIdSchema.optional(),
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
			const day = 1000 * 60 * 60 * 24 * 3; // 3日前まで

			const notes = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						{
							userHost: null,
							score: { gt: 0 },
							createdAt: { gt: new Date(Date.now() - day) },
							visibility: 'public',
							channelId: ps.channelId,
						},
						me
							? await this.prismaQueryService.getMutingWhereForNote(me.id)
							: {},
						me ? this.prismaQueryService.getBlockedWhereForNote(me.id) : {},
					],
				},
				orderBy: { score: 'desc' },
				take: 100,
			});

			notes.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return (await this.noteEntityService.packMany(
				notes.slice(ps.offset, ps.offset + ps.limit),
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
