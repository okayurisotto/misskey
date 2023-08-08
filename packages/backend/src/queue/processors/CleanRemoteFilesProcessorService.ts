import { Injectable } from '@nestjs/common';
import type { DriveFile } from '@/models/index.js';
import type Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type { drive_file } from '@prisma/client';
import type * as Bull from 'bullmq';

@Injectable()
export class CleanRemoteFilesProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly driveService: DriveService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('clean-remote-files');
	}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<void> {
		this.logger.info('Deleting cached remote files...');

		let deletedCount = 0;
		let cursor: DriveFile['id'] | null = null;
		const take = 8;

		while (true) {
			const files: drive_file[] = await this.prismaService.client.drive_file.findMany({
				where: {
					userHost: { not: null },
					isLink: false,
					...(cursor ? { id: { gt: cursor } } : {}),
				},
				take,
				orderBy: { id: 'asc' },
			});

			if (files.length === 0) {
				job.updateProgress(100);
				break;
			}

			cursor = files.at(-1)?.id ?? null;

			await Promise.all(files.map(file => this.driveService.deleteFileSync(file, true)));

			deletedCount += take;

			const total = await this.prismaService.client.drive_file.count({
				where: {
					userHost: { not: null },
					isLink: false,
				},
			});

			job.updateProgress(deletedCount / total);
		}

		this.logger.succ('All cached remote files has been deleted.');
	}
}
