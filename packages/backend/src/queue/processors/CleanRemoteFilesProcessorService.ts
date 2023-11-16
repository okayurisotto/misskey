import { Injectable } from '@nestjs/common';
import type Logger from '@/misc/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class CleanRemoteFilesProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly driveService: DriveService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('clean-remote-files');
	}

	public async process(job: Bull.Job<Record<string, unknown>>): Promise<void> {
		this.logger.info('Deleting cached remote files...');

		const files = await this.prismaService.client.drive_file.findMany({
			where: { userHost: { not: null }, isLink: false },
		});

		let count = 0;
		const max = files.length;

		await Promise.all(
			files.map(async (file) => {
				await this.driveService.deleteFileSync(file, true);
				count++;
				await job.updateProgress(count / max);
			}),
		);

		this.logger.succ('All cached remote files has been deleted.');
	}
}
