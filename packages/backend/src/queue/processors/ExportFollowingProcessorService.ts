import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import type Logger from '@/misc/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { createTemp } from '@/misc/create-temp.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbExportFollowingData } from '../types.js';

const INACTIVE_BORDER = 1000 * 60 * 60 * 24 * 90;

@Injectable()
export class ExportFollowingProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly utilityService: UtilityService,
		private readonly driveService: DriveService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('export-following');
	}

	@bindThis
	public async process(job: Bull.Job<DbExportFollowingData>): Promise<void> {
		this.logger.info(`Exporting following of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: {
				muting_muting_muterIdTouser: true,
				following_following_followeeIdTouser: {
					orderBy: { id: 'asc' },
					include: { user_following_followerIdTouser: true },
				},
			},
		});
		if (user === null) return;

		const muteeIds = new Set(
			user.muting_muting_muterIdTouser.map(({ muteeId }) => muteeId),
		);

		const content = user.following_following_followeeIdTouser
			.filter((following) => {
				if (!job.data.excludeMuting) return true;
				return !muteeIds.has(following.followeeId);
			})
			.map((following) => {
				const user = following.user_following_followerIdTouser;

				if (
					job.data.excludeInactive &&
					user.updatedAt &&
					Date.now() - +user.updatedAt > INACTIVE_BORDER
				) {
					return;
				}

				return this.utilityService.getFullApAccount(user.username, user.host);
			})
			.map((entry) => entry + '\n')
			.join();

		const [path, cleanup] = await createTemp();
		try {
			this.logger.info(`Temp file is ${path}`);
			fs.writeFileSync(path, content);
			this.logger.succ(`Exported to: ${path}`);

			const fileName =
				'following-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.csv';
			const driveFile = await this.driveService.addFile({
				user,
				path,
				name: fileName,
				force: true,
				ext: 'csv',
			});

			this.logger.succ(`Exported to: ${driveFile.id}`);
		} finally {
			cleanup();
		}
	}
}
