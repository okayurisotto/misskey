import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteReadService } from '@/core/NoteReadService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	res,
} as const;

export const paramDef = z.object({
	following: z.boolean().default(false),
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	visibility: z.enum(['public', 'home', 'followers', 'specified']).optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private noteEntityService: NoteEntityService,
		private noteReadService: NoteReadService,
		private prismaService: PrismaService,
		private prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const mentions = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{
							OR: [
								{ mentions: { has: me.id } },
								{ visibleUserIds: { has: me.id } },
							],
						},
						this.prismaQueryService.getVisibilityWhereForNote(me.id),
						await this.prismaQueryService.getMutingWhereForNote(me.id),
						await this.prismaQueryService.getNoteThreadMutingWhereForNote(
							me.id,
						),
						this.prismaQueryService.getBlockedWhereForNote(me.id),
						ps.visibility ? { visibility: ps.visibility } : {},
						ps.following
							? {
									OR: [
										{
											user: {
												following_following_followeeIdTouser: {
													some: { followerId: me.id },
												},
											},
										},
										{ userId: me.id },
									],
							  }
							: {},
					],
				},
			});

			this.noteReadService.read(me.id, mentions);

			return (await this.noteEntityService.packMany(
				mentions,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
