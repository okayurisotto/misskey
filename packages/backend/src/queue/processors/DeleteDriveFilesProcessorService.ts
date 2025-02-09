import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileDeleteService } from '@/core/DriveFileDeleteService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';

@Injectable()
export class DeleteDriveFilesProcessorService {
	private readonly logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly driveFileDeleteService: DriveFileDeleteService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('delete-drive-files');
	}

	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Deleting drive files of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: { driveFiles: true },
		});
		if (user == null) return;

		const total = user.driveFiles.length;
		let count = 0;

		await Promise.all(
			user.driveFiles.map(async (file) => {
				await this.driveFileDeleteService.delete(file);
				count++;
				await job.updateProgress(count / total);
			}),
		);

		this.logger.succ(
			`All drive files (${count}) of ${user.id} has been deleted.`,
		);
	}
}
