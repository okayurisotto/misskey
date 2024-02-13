import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { stlDisabled } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	res,
	errors: { stlDisabled: stlDisabled },
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
		private readonly roleService: RoleService,
		private readonly activeUsersChart: ActiveUsersChart,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(me.id);
			if (!policies.ltlAvailable) {
				throw new ApiError(meta.errors.stlDisabled);
			}

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
								{ AND: [{ visibility: 'public' }, { userHost: null }] },
								{
									user: {
										followings_follower: {
											some: { followeeId: me.id },
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
										{ userId: me.id },
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
										{ renoteUserId: me.id },
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
			});

			process.nextTick(() => {
				this.activeUsersChart.read(me);
			});

			return await this.noteEntityService.packMany(timeline, me);
		});
	}
}
