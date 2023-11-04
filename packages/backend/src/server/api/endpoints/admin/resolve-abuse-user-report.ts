import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { AbuseUserReportEntityService } from '@/core/entities/AbuseUserReportEntityService.js';

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
		private readonly abuseUserReportEntityService: AbuseUserReportEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.abuseUserReportEntityService.resolve(ps.reportId, {
				forward: ps.forward,
				assigneeId: me.id,
			});
		});
	}
}
