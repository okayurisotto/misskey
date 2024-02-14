import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import type { AbuseUserReportSchema } from '@/models/zod/AbuseUserReportSchema.js';
import { PaginationQuery } from '../PrismaQueryService.js';
import type { AbuseUserReport, Prisma, User } from '@prisma/client';
import type { z } from 'zod';

type AbuseUserReportPackData = {
	report: EntityMap<'id', AbuseUserReport>;
	user: EntityMap<'id', User>;
};

@Injectable()
export class AbuseUserReportFetchingService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	private async pack(
		id: string,
		data: AbuseUserReportPackData,
	): Promise<z.infer<typeof AbuseUserReportSchema>> {
		const report = data.report.get(id);
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

	public async showMany(
		where: Prisma.AbuseUserReportWhereInput,
		paginationQuery?: PaginationQuery,
	): Promise<z.infer<typeof AbuseUserReportSchema>[]> {
		const reports = await this.prismaService.client.abuseUserReport.findMany({
			...paginationQuery,
			where:
				paginationQuery === undefined
					? where
					: { AND: [where, paginationQuery.where] },
			include: { assignee: true, reporter: true, targetUser: true },
		});

		const data: AbuseUserReportPackData = {
			report: new EntityMap('id', reports),
			user: new EntityMap(
				'id',
				reports.flatMap((report) => [
					report.assignee,
					report.reporter,
					report.targetUser,
				]),
			),
		};

		return await Promise.all(reports.map(({ id }) => this.pack(id, data)));
	}
}
