import { Injectable } from '@nestjs/common';
import type Logger from '@/misc/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';

@Injectable()
export class DeleteDriveFilesProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly driveService: DriveService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('delete-drive-files');
	}

	@bindThis
	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Deleting drive files of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: { drive_file_drive_file_userIdTouser: true },
		});
		if (user == null) return;

		const files = user.drive_file_drive_file_userIdTouser;
		const total = files.length;
		let count = 0;

		await Promise.all(
			files.map(async (file) => {
				await this.driveService.deleteFileSync(file);
				count++;
				await job.updateProgress(count / total);
			}),
		);

		this.logger.succ(
			`All drive files (${count}) of ${user.id} has been deleted.`,
		);
	}
}
