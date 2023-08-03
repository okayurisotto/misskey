import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AbuseUserReportsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { AbuseUserReportEntityService } from '@/core/entities/AbuseUserReportEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { AbuseUserReportSchema } from '@/models/zod/AbuseUserReportSchema.js';

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
		@Inject(DI.abuseUserReportsRepository)
		private abuseUserReportsRepository: AbuseUserReportsRepository,

		private abuseUserReportEntityService: AbuseUserReportEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(
				this.abuseUserReportsRepository.createQueryBuilder('report'),
				ps.sinceId,
				ps.untilId,
			);

			switch (ps.state) {
				case 'resolved':
					query.andWhere('report.resolved = TRUE');
					break;
				case 'unresolved':
					query.andWhere('report.resolved = FALSE');
					break;
			}

			switch (ps.reporterOrigin) {
				case 'local':
					query.andWhere('report.reporterHost IS NULL');
					break;
				case 'remote':
					query.andWhere('report.reporterHost IS NOT NULL');
					break;
			}

			switch (ps.targetUserOrigin) {
				case 'local':
					query.andWhere('report.targetUserHost IS NULL');
					break;
				case 'remote':
					query.andWhere('report.targetUserHost IS NOT NULL');
					break;
			}

			const reports = await query.limit(ps.limit).getMany();

			return (await Promise.all(
				reports.map((report) => this.abuseUserReportEntityService.pack(report)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
