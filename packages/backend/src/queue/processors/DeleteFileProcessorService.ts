import { Injectable } from '@nestjs/common';
import { DriveService } from '@/core/DriveService.js';
import { bindThis } from '@/decorators.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { ObjectStorageFileJobData } from '../types.js';

@Injectable()
export class DeleteFileProcessorService {
	constructor(
		private readonly driveService: DriveService,
		private readonly queueLoggerService: QueueLoggerService,
	) {}

	@bindThis
	public async process(job: Bull.Job<ObjectStorageFileJobData>): Promise<string> {
		const key: string = job.data.key;

		await this.driveService.deleteObjectStorageFile(key);

		return 'Success';
	}
}
