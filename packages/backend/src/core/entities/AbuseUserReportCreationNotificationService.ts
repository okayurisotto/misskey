import sanitizeHtml from 'sanitize-html';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MetaService } from '@/core/MetaService.js';
import { EmailService } from '@/core/EmailService.js';
import { RoleUtilService } from '../RoleUtilService.js';
import type { AbuseUserReport } from '@prisma/client';

@Injectable()
export class AbuseUserReportCreationNotificationService {
	constructor(
		private readonly emailService: EmailService,
		private readonly globalEventService: GlobalEventService,
		private readonly metaService: MetaService,
		private readonly roleUtilService: RoleUtilService,
	) {}

	/**
	 * モデレーターへ通報が作成されたことを通知する。
	 */
	private async notifyToModerators(report: AbuseUserReport): Promise<void> {
		const moderators = await this.roleUtilService.getModerators();

		for (const moderator of moderators) {
			this.globalEventService.publishAdminStream(
				moderator.id,
				'newAbuseUserReport',
				pick(report, ['id', 'targetUserId', 'reporterId', 'comment']),
			);
		}
	}

	/**
	 * インスタンスに登録された管理者のメールアドレスに通知する。
	 */
	private async sendEmail(report: AbuseUserReport): Promise<void> {
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

	/**
	 * モデレーターへ通報が作成されたことを通知する。
	 * また、インスタンスに登録された管理者のメールアドレスにも、通報が作成された旨をメールで知らせる。
	 */
	public async notify(report: AbuseUserReport): Promise<void> {
		await Promise.all([
			this.notifyToModerators(report),
			this.sendEmail(report),
		]);
	}
}
