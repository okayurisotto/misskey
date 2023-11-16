import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes', 'hashtags'],
	res,
} as const;

const paramDef_base = z
	.object({
		reply: z.boolean().nullable().default(null),
		renote: z.boolean().nullable().default(null),
		withFiles: z
			.boolean()
			.default(false)
			.describe('Only show notes that have attached files.'),
		poll: z.boolean().nullable().default(null),
		limit: limit({ max: 100, default: 10 }),
	})
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));
export const paramDef = z.union([
	paramDef_base.merge(
		z.object({
			tag: z.string().min(1),
		}),
	),
	paramDef_base.merge(
		z.object({
			query: z
				.array(z.array(z.string().min(1)).min(1))
				.min(1)
				.describe(
					'The outer arrays are chained with OR, the inner arrays are chained with AND.',
				),
		}),
	),
]);

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
						this.prismaQueryService.getVisibilityWhereForNote(me?.id ?? null),
						...(me
							? [
									await this.prismaQueryService.getMutingWhereForNote(me.id),
									this.prismaQueryService.getBlockedWhereForNote(me.id),
							  ]
							: []),
						'tag' in ps ? { tags: { has: ps.tag } } : {},
						'query' in ps
							? { OR: ps.query.map((q) => ({ tags: { hasEvery: q } })) }
							: {},
						ps.reply !== null
							? ps.reply
								? { replyId: { not: null } }
								: { replyId: null }
							: {},
						ps.renote !== null
							? ps.renote
								? { renoteId: { not: null } }
								: { renoteId: null }
							: {},
						ps.withFiles ? { fileIds: { isEmpty: false } } : {},
						ps.poll !== null ? { hasPoll: ps.poll } : {},
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await this.noteEntityService.packMany(notes, me);
		});
	}
}
