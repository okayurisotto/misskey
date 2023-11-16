import { Injectable } from '@nestjs/common';
import { DriveService } from '@/core/DriveService.js';
import type * as Bull from 'bullmq';
import type { ObjectStorageFileJobData } from '../types.js';

@Injectable()
export class DeleteFileProcessorService {
	constructor(private readonly driveService: DriveService) {}

	public async process(
		job: Bull.Job<ObjectStorageFileJobData>,
	): Promise<string> {
		await this.driveService.deleteObjectStorageFile(job.data.key);
		return 'Success';
	}
}
