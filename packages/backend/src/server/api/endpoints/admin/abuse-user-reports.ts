import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AbuseUserReportEntityService } from '@/core/entities/AbuseUserReportEntityService.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { AbuseUserReportSchema } from '@/models/zod/AbuseUserReportSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { EntityMap } from '@/misc/EntityMap.js';

const res = z.array(AbuseUserReportSchema);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z
	.object({
		limit: limit({ max: 100, default: 10 }),
		state: z.string().nullable().default(null),
		reporterOrigin: z.enum(['combined', 'local', 'remote']).default('combined'),
		targetUserOrigin: z
			.enum(['combined', 'local', 'remote'])
			.default('combined'),
		forwarded: z.boolean().default(false),
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
		private readonly abuseUserReportEntityService: AbuseUserReportEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const reports =
				await this.prismaService.client.abuse_user_report.findMany({
					where: {
						AND: [
							paginationQuery.where,
							ps.state === 'resolved' ? { resolved: true } : {},
							ps.state === 'unresolved' ? { resolved: false } : {},
							ps.reporterOrigin === 'local' ? { reporterHost: null } : {},
							ps.reporterOrigin === 'remote'
								? { reporterHost: { not: null } }
								: {},
							ps.targetUserOrigin === 'local' ? { targetUserHost: null } : {},
							ps.targetUserOrigin === 'remote'
								? { targetUserHost: { not: null } }
								: {},
						],
					},
					orderBy: paginationQuery.orderBy,
					take: ps.limit,
					include: {
						user_abuse_user_report_assigneeIdTouser: true,
						user_abuse_user_report_reporterIdTouser: true,
						user_abuse_user_report_targetUserIdTouser: true,
					},
				});

			const data = {
				report: new EntityMap('id', reports),
				user: new EntityMap(
					'id',
					reports
						.map((report) => [
							report.user_abuse_user_report_assigneeIdTouser,
							report.user_abuse_user_report_reporterIdTouser,
							report.user_abuse_user_report_targetUserIdTouser,
						])
						.flat(),
				),
			};

			return await Promise.all(
				reports.map(({ id }) =>
					this.abuseUserReportEntityService.pack(id, data),
				),
			);
		});
	}
}
