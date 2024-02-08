import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['account', 'notes', 'clips'],
	requireCredential: false,
	kind: 'read:account',
	res,
} as const;

export const paramDef = z
	.object({
		clipId: MisskeyIdSchema,
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
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
				take: ps.limit,
			});

			const clipNotes = await this.prismaService.client.clipNote.findMany({
				where: {
					AND: [
						{
							clip: {
								OR: [{ isPublic: true }, ...(me ? [{ userId: me.id }] : [])],
							},
						},
						{
							note: {
								AND: [
									paginationQuery.where,
									...(me
										? [
												this.prismaQueryService.getVisibilityWhereForNote(
													me.id,
												),
												await this.prismaQueryService.getMutingWhereForNote(
													me.id,
												),
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
				skip: paginationQuery.skip,
				take: paginationQuery.take,
			});

			return await this.noteEntityService.packMany(
				clipNotes.map((clipNote) => clipNote.note),
				me,
			);
		});
	}
}
