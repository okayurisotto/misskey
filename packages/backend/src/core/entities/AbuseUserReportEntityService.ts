import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { AbuseUserReportSchema } from '@/models/zod/AbuseUserReportSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { abuse_user_report, user } from '@prisma/client';

@Injectable()
export class AbuseUserReportEntityService {
	constructor(private readonly userEntityService: UserEntityService) {}

	public async pack(
		report: abuse_user_report,
		ext: {
			assignee: user | null;
			reporter: user;
			targetUser: user;
		},
	): Promise<z.infer<typeof AbuseUserReportSchema>> {
		const result = await awaitAll({
			reporter: () =>
				this.userEntityService.pack(ext.reporter, null, { detail: true }),
			targetUser: () =>
				this.userEntityService.pack(ext.targetUser, null, { detail: true }),
			assignee: () =>
				ext.assignee
					? this.userEntityService.pack(ext.assignee, null, { detail: true })
					: Promise.resolve(null),
		});

		return {
			...pick(report, [
				'id',
				'comment',
				'resolved',
				'reporterId',
				'targetUserId',
				'assigneeId',
				'forwarded',
			]),
			createdAt: report.createdAt.toISOString(),
			...result,
		};
	}
}
