import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { IdService } from '@/core/IdService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	res,
} as const;

export const paramDef = z
	.object({
		limit: limit({ max: 100, default: 10 }),
		includeMyRenotes: z.boolean().default(true),
		includeRenotedMyNotes: z.boolean().default(true),
		includeLocalRenotes: z.boolean().default(true),
		withFiles: z.boolean().default(false),
		withReplies: z.boolean().default(false),
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
		private readonly noteEntityService: NoteEntityPackService,
		private readonly activeUsersChart: ActiveUsersChart,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
				sinceDate: ps.sinceDate,
				untilDate: ps.untilDate,
			});

			const timeline = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{
							id: {
								gt: this.idService.genId(
									new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
								),
							},
						},
						{
							OR: [
								{ userId: me.id },
								{
									user: {
										followings_followee: {
											some: { followerId: me.id },
										},
									},
								},
							],
						},
						this.prismaQueryService.getChannelWhereForNote(me.id),
						this.prismaQueryService.getRepliesWhereForNote(me.id),
						this.prismaQueryService.getVisibilityWhereForNote(me.id),
						await this.prismaQueryService.getMutingWhereForNote(me.id),
						await this.prismaQueryService.getNoteThreadMutingWhereForNote(
							me.id,
						),
						this.prismaQueryService.getBlockedWhereForNote(me.id),
						await this.prismaQueryService.getRenoteMutingWhereForNote(me.id),
						ps.includeMyRenotes
							? {}
							: {
									OR: [
										{ userId: { not: me.id } },
										{ renoteId: null },
										{ text: { not: null } },
										{ fileIds: { isEmpty: false } },
										{ hasPoll: true },
									],
							  },
						ps.includeRenotedMyNotes
							? {}
							: {
									OR: [
										{ renoteUserId: { not: me.id } },
										{ renoteId: null },
										{ text: { not: null } },
										{ fileIds: { isEmpty: false } },
										{ hasPoll: true },
									],
							  },
						ps.includeLocalRenotes
							? {}
							: {
									OR: [
										{ renoteUserHost: { not: null } },
										{ renoteId: null },
										{ text: { not: null } },
										{ fileIds: { isEmpty: false } },
										{ hasPoll: true },
									],
							  },
						ps.withFiles ? { fileIds: { isEmpty: false } } : {},
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			process.nextTick(() => {
				this.activeUsersChart.read(me);
			});

			return await this.noteEntityService.packMany(timeline, me);
		});
	}
}
