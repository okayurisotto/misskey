import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import { createTemp } from '@/misc/create-temp.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileAddService } from '@/core/DriveFileAddService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbExportFollowingData } from '../types.js';

const INACTIVE_BORDER = 1000 * 60 * 60 * 24 * 90;

@Injectable()
export class ExportFollowingProcessorService {
	private readonly logger;

	constructor(
		private readonly utilityService: UtilityService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly driveFileAddService: DriveFileAddService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('export-following');
	}

	public async process(job: Bull.Job<DbExportFollowingData>): Promise<void> {
		this.logger.info(`Exporting following of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: {
				mutings_muter: true,
				followings_followee: {
					orderBy: { id: 'asc' },
					include: { follower: true },
				},
			},
		});
		if (user === null) return;

		const muteeIds = new Set(
			user.mutings_muter.map(({ muteeId }) => muteeId),
		);

		const content = user.followings_followee
			.filter((following) => {
				if (!job.data.excludeMuting) return true;
				return !muteeIds.has(following.followeeId);
			})
			.map((following) => {
				const user = following.follower;

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
			const driveFile = await this.driveFileAddService.add({
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
