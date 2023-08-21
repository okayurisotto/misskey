import { noSuchNote______________ } from '@/server/api/errors.js';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
	errors: { noSuchNote: noSuchNote______________ },
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
		private readonly getterService: GetterService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const renotes = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ renoteId: note.id },
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

			return (await this.noteEntityService.packMany(
				renotes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
