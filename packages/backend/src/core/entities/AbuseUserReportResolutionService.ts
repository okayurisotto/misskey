import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import { InstanceActorService } from '@/core/InstanceActorService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { QueueService } from '@/core/QueueService.js';
import { UserEntityUtilService } from './UserEntityUtilService.js';

@Injectable()
export class AbuseUserReportResolutionService {
	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly instanceActorService: InstanceActorService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * 通報の解決を配送する。
	 * 報告者の匿名化のため、InstanceActorが本来の報告者に代わって設定される。
	 */
	private async forward(opts: {
		comment: string;
		inbox: string;
		uri: string;
	}): Promise<void> {
		const actor = await this.instanceActorService.getInstanceActor();

		const iFlag = this.apRendererService.renderFlag(
			actor,
			opts.uri,
			opts.comment,
		);

		const content = this.apRendererService.addContext(iFlag);

		await this.queueService.deliver(actor, content, opts.inbox, false);
	}

	/**
	 * 通報を解決する。
	 */
	public async resolve(
		reportId: string,
		opts: {
			/** 配送するかどうか */
			forward: boolean;
			assigneeId?: string | undefined;
		},
	): Promise<void> {
		const report =
			await this.prismaService.client.abuseUserReport.findUniqueOrThrow({
				where: { id: reportId },
				include: { targetUser: true },
			});

		const targetUser = report.targetUser;

		/**
		 * 解決を配送するかどうか。
		 * そもそも通報されたユーザーがリモートのユーザーではなかった場合は配送されない。
		 */
		const forwarded =
			opts.forward && this.userEntityUtilService.isRemoteUser(targetUser);

		if (forwarded) {
			if (targetUser.inbox === null) {
				throw new Error(`AbuseUserReport.targetUser.inbox === null`);
			}

			await this.forward({
				comment: report.comment,
				inbox: targetUser.inbox,
				uri: targetUser.uri,
			});
		}

		// TODO: 実行順は変わってしまうがクエリをまとめたい
		await this.prismaService.client.abuseUserReport.update({
			where: { id: reportId },
			data: {
				assigneeId: opts.assigneeId,
				forwarded,
				resolved: true,
			},
		});
	}
}
