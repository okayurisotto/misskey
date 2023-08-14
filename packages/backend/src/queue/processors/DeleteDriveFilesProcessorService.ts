import { Injectable } from '@nestjs/common';
import { drive_file } from '@prisma/client';
import type Logger from '@/logger.js';
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
		this.logger = this.queueLoggerService.logger.createSubLogger('delete-drive-files');
	}

	@bindThis
	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Deleting drive files of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({ where: { id: job.data.user.id } });
		if (user == null) {
			return;
		}

		let deletedCount = 0;
		let cursor: drive_file['id'] | null = null;

		while (true) {
			const files: drive_file[] = await this.prismaService.client.drive_file.findMany({
				where: {
					userId: user.id,
					...(cursor ? { id: { gt: cursor } } : {}),
				},
				take: 100,
				orderBy: { id: 'asc' },
			});

			if (files.length === 0) {
				job.updateProgress(100);
				break;
			}

			cursor = files.at(-1)?.id ?? null;

			for (const file of files) {
				await this.driveService.deleteFileSync(file);
				deletedCount++;
			}

			const total = await this.prismaService.client.drive_file.count({
				where: { userId: user.id },
			});

			job.updateProgress(deletedCount / total);
		}

		this.logger.succ(`All drive files (${deletedCount}) of ${user.id} has been deleted.`);
	}
}
