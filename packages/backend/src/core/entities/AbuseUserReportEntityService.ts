import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import type { AbuseUserReportSchema } from '@/models/zod/AbuseUserReportSchema.js';
import type { EntityMap } from '@/misc/EntityMap.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { abuse_user_report, user } from '@prisma/client';

@Injectable()
export class AbuseUserReportEntityService {
	constructor(private readonly userEntityService: UserEntityService) {}

	public async pack(
		reportId: abuse_user_report['id'],
		data: {
			report: EntityMap<'id', abuse_user_report>;
			user: EntityMap<'id', user>;
		},
	): Promise<z.infer<typeof AbuseUserReportSchema>> {
		const report = data.report.get(reportId);
		const reporter = data.user.get(report.reporterId);
		const targetUser = data.user.get(report.targetUserId);
		const assignee = report.assigneeId
			? data.user.get(report.assigneeId)
			: null;

		const [packedReporter, packedTargetUser, packedAssignee] =
			await Promise.all([
				this.userEntityService.packDetailed(reporter, null),
				this.userEntityService.packDetailed(targetUser, null),
				assignee !== null
					? this.userEntityService.packDetailed(assignee, null)
					: null,
			]);

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
			reporter: packedReporter,
			targetUser: packedTargetUser,
			assignee: packedAssignee,
		};
	}
}
