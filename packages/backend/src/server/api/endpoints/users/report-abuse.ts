import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { AbuseUserReportCreationNotificationService } from '@/core/entities/AbuseUserReportCreationNotificationService.js';
import { AbuseUserReportCreationService } from '@/core/entities/AbuseUserReportCreationService.js';

export const meta = {
	tags: ['users'],
	requireCredential: true,
	description: 'File a report.',
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
	comment: z.string().min(1).max(2048),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly abuseUserReportCreationService: AbuseUserReportCreationService,
		private readonly abuseUserReportCreationNotificationService: AbuseUserReportCreationNotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const report = await this.abuseUserReportCreationService.create({
				comment: ps.comment,
				reporterId: me.id,
				targetUserId: ps.userId,
			});

			setImmediate(async () => {
				await this.abuseUserReportCreationNotificationService.notify(report);
			});
		});
	}
}
