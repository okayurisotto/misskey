import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { gtlDisabled } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { RoleService } from '@/core/RoleService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	res,
	errors: { gtlDisabled: gtlDisabled },
} as const;

export const paramDef = z
	.object({
		withFiles: z.boolean().default(false),
		withReplies: z.boolean().default(false),
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
		private readonly noteEntityService: NoteEntityService,
		private readonly roleService: RoleService,
		private readonly activeUsersChart: ActiveUsersChart,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(
				me ? me.id : null,
			);
			if (!policies.gtlAvailable) {
				throw new ApiError(meta.errors.gtlDisabled);
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
						{ visibility: 'public', channelId: null },
						this.prismaQueryService.getRepliesWhereForNote(me?.id ?? null),
						...(me
							? [
									await this.prismaQueryService.getMutingWhereForNote(me.id),
									await this.prismaQueryService.getNoteThreadMutingWhereForNote(
										me.id,
									),
									this.prismaQueryService.getBlockedWhereForNote(me.id),
									await this.prismaQueryService.getRenoteMutingWhereForNote(
										me.id,
									),
							  ]
							: []),
						ps.withFiles ? { fileIds: { isEmpty: false } } : {},
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			process.nextTick(() => {
				if (me) {
					this.activeUsersChart.read(me);
				}
			});

			return (await this.noteEntityService.packMany(
				timeline,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
