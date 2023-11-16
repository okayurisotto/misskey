import { Injectable } from '@nestjs/common';
import z from 'zod';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z
	.object({
		noteId: MisskeyIdSchema,
		limit: limit({ max: 100, default: 10 }),
	})
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

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
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const notes = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{
							OR: [
								{ replyId: ps.noteId },
								{
									AND: [
										{ renoteId: ps.noteId },
										{
											OR: [
												{ text: { not: null } },
												{ fileIds: { isEmpty: false } },
												{ hasPoll: true },
											],
										},
									],
								},
							],
						},
						this.prismaQueryService.getVisibilityWhereForNote(me?.id ?? null),
						...(me
							? [
									await this.prismaQueryService.getMutingWhereForNote(me.id),
									this.prismaQueryService.getBlockedWhereForNote(me.id),
							  ]
							: []),
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await this.noteEntityService.packMany(notes, me);
		});
	}
}
