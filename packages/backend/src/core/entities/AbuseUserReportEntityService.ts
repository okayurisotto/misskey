import sanitizeHtml from 'sanitize-html';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { InstanceActorService } from '@/core/InstanceActorService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { QueueService } from '@/core/QueueService.js';
import type { AbuseUserReportSchema } from '@/models/zod/AbuseUserReportSchema.js';
import { RoleService } from '@/core/RoleService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MetaService } from '@/core/MetaService.js';
import { EmailService } from '@/core/EmailService.js';
import { PaginationQuery } from '../PrismaQueryService.js';
import type { AbuseUserReport, Prisma, user } from '@prisma/client';
import type { z } from 'zod';

type AbuseUserReportPackData = {
	report: EntityMap<'id', AbuseUserReport>;
	user: EntityMap<'id', user>;
};

@Injectable()
export class AbuseUserReportEntityService {
	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly emailService: EmailService,
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly instanceActorService: InstanceActorService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly roleService: RoleService,
		private readonly userEntityService: UserEntityService,
	) {}

	public async pack(
		id: AbuseUserReport['id'],
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

	public async create(
		data: Pick<
			Prisma.AbuseUserReportUncheckedCreateInput,
			'comment' | 'reporterId' | 'targetUserId'
		>,
	): Promise<z.infer<typeof AbuseUserReportSchema>> {
		if (data.reporterId === data.targetUserId) {
			throw new Error();
		}

		const targetUser = await this.prismaService.client.user.findUniqueOrThrow({
			where: { id: data.targetUserId },
		});

		if (await this.roleService.isAdministrator(targetUser)) {
			throw new Error();
		}

		const result = await this.prismaService.client.abuseUserReport.create({
			data: {
				...pick(data, ['comment', 'reporterId', 'targetUserId']),
				id: this.idService.genId(),
				createdAt: new Date(),
			},
			include: { reporter: true, targetUser: true },
		});

		return await this.pack(result.id, {
			report: new EntityMap('id', [result]),
			user: new EntityMap('id', [result.reporter, result.targetUser]),
		});
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
				reports
					.map((report) => [
						report.assignee,
						report.reporter,
						report.targetUser,
					])
					.flat(),
			),
		};

		return await Promise.all(reports.map(({ id }) => this.pack(id, data)));
	}

	public async resolve(
		id: AbuseUserReport['id'],
		options: {
			forward: boolean;
			assigneeId?: AbuseUserReport['id'] | undefined;
		},
	): Promise<void> {
		const report =
			await this.prismaService.client.abuseUserReport.findUniqueOrThrow({
				where: { id },
				include: { targetUser: true },
			});

		const forwarded =
			options.forward && this.userEntityService.isRemoteUser(report.targetUser);

		if (forwarded) {
			const actor = await this.instanceActorService.getInstanceActor();

			if (report.targetUser.uri === null) {
				throw new Error();
			}

			const iFlag = this.apRendererService.renderFlag(
				actor,
				report.targetUser.uri,
				report.comment,
			);

			const content = this.apRendererService.addContext(iFlag);

			await this.queueService.deliver(
				actor,
				content,
				report.targetUser.inbox,
				false,
			);
		}

		await this.prismaService.client.abuseUserReport.update({
			where: { id },
			data: {
				assigneeId: options.assigneeId,
				forwarded,
				resolved: true,
			},
		});
	}

	public async publishToModerators(
		report: z.infer<typeof AbuseUserReportSchema>,
	): Promise<void> {
		const moderators = await this.roleService.getModerators();

		for (const moderator of moderators) {
			this.globalEventService.publishAdminStream(
				moderator.id,
				'newAbuseUserReport',
				pick(report, ['id', 'targetUserId', 'reporterId', 'comment']),
			);
		}

		const meta = await this.metaService.fetch();
		if (meta.email) {
			await this.emailService.sendEmail(
				meta.email,
				'New abuse report',
				sanitizeHtml(report.comment),
				sanitizeHtml(report.comment),
			);
		}
	}
}
