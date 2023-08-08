import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AbuseUserReportEntityService } from '@/core/entities/AbuseUserReportEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { AbuseUserReportSchema } from '@/models/zod/AbuseUserReportSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(AbuseUserReportSchema);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	state: z.string().nullable().default(null),
	reporterOrigin: z
		.enum(['combined', 'local', 'remote'])
		.default('combined')
		.optional(),
	targetUserOrigin: z
		.enum(['combined', 'local', 'remote'])
		.default('combined')
		.optional(),
	forwarded: z.boolean().default(false),
});

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
				});

			return (await Promise.all(
				reports.map((report) => this.abuseUserReportEntityService.pack(report)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
