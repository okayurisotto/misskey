import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteReactionEntityService } from '@/core/entities/NoteReactionEntityService.js';
import { NoteReactionSchema } from '@/models/zod/NoteReactionSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteReactionSchema);
export const meta = {
	tags: ['users', 'reactions'],
	requireCredential: false,
	description: 'Show all reactions this user made.',
	res,
} as const;

export const paramDef = z
	.object({
		userId: MisskeyIdSchema,
		limit: limit({ max: 100, default: 10 }),
	})
	.merge(PaginationSchema);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly noteReactionEntityService: NoteReactionEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
				sinceDate: ps.sinceDate,
				untilDate: ps.untilDate,
				take: ps.limit,
			});

			const reactions = await this.prismaService.client.noteReaction.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{
							user: {
								id: ps.userId,
								OR: [
									{ user_profile: { publicReactions: true } },
									...(me ? [{ id: me.id }] : []),
								],
							},
						},
						this.prismaQueryService.getVisibilityWhereForNoteReaction(
							me?.id ?? null,
						),
					],
				},
				orderBy: paginationQuery.orderBy,
				skip: paginationQuery.skip,
				take: paginationQuery.take,
			});

			return await Promise.all(
				reactions.map((reaction) =>
					this.noteReactionEntityService.pack(reaction, me, { withNote: true }),
				),
			);
		});
	}
}
