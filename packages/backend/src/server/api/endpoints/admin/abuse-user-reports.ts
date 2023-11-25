import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AbuseUserReportFetchingService } from '@/core/entities/AbuseUserReportFetchingService.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { AbuseUserReportSchema } from '@/models/zod/AbuseUserReportSchema.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

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
		private readonly abuseUserReportFetchingService: AbuseUserReportFetchingService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
				take: ps.limit,
			});

			return await this.abuseUserReportFetchingService.showMany(
				{
					AND: [
						ps.state === 'resolved' ? { resolved: true } : {},
						ps.state === 'unresolved' ? { resolved: false } : {},
						ps.reporterOrigin === 'local' ? { reporter: { host: null } } : {},
						ps.reporterOrigin === 'remote'
							? { reporter: { host: { not: null } } }
							: {},
						ps.targetUserOrigin === 'local'
							? { targetUser: { host: null } }
							: {},
						ps.targetUserOrigin === 'remote'
							? { targetUser: { host: { not: null } } }
							: {},
					],
				},
				paginationQuery,
			);
		});
	}
}
