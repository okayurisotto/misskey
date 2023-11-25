import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { AbuseUserReportResolutionService } from '@/core/entities/AbuseUserReportResolutionService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({
	reportId: MisskeyIdSchema,
	forward: z.boolean().default(false),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly abuseUserReportResolutionService: AbuseUserReportResolutionService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.abuseUserReportResolutionService.resolve(ps.reportId, {
				forward: ps.forward,
				assigneeId: me.id,
			});
		});
	}
}
