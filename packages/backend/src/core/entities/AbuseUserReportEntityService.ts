import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { AbuseUserReport } from '@/models/entities/AbuseUserReport.js';
import { bindThis } from '@/decorators.js';
import { AbuseUserReportSchema } from '@/models/zod/AbuseUserReportSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { abuse_user_report } from '@prisma/client';

@Injectable()
export class AbuseUserReportEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src: AbuseUserReport['id'] | abuse_user_report,
	): Promise<z.infer<typeof AbuseUserReportSchema>> {
		const report =
			typeof src === 'object'
				? src
				: await this.prismaService.client.abuse_user_report.findUniqueOrThrow({ where: { id: src } });

		const result = await awaitAll({
			reporter: () =>
				this.userEntityService.pack(
					report.reporterId,
					null,
					{ detail: true },
				),
			targetUser: () =>
				this.userEntityService.pack(
					report.targetUserId,
					null,
					{ detail: true },
				),
			assignee: () =>
				report.assigneeId
					? this.userEntityService.pack(
							report.assigneeId,
							null,
							{ detail: true },
					  )
					: Promise.resolve(null),
		});

		return {
			id: report.id,
			createdAt: report.createdAt.toISOString(),
			comment: report.comment,
			resolved: report.resolved,
			reporterId: report.reporterId,
			targetUserId: report.targetUserId,
			assigneeId: report.assigneeId,
			reporter: result.reporter,
			targetUser: result.targetUser,
			assignee: result.assignee,
			forwarded: report.forwarded,
		};
	}
}
