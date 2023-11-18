import { Injectable } from '@nestjs/common';
import { ObjectStorageFileDeleteService } from '@/core/ObjectStorageFileDeleteService.js';
import type * as Bull from 'bullmq';
import type { ObjectStorageFileJobData } from '../types.js';

@Injectable()
export class DeleteFileProcessorService {
	constructor(
		private readonly objectStorageFileDeleteService: ObjectStorageFileDeleteService,
	) {}

	public async process(
		job: Bull.Job<ObjectStorageFileJobData>,
	): Promise<string> {
		await this.objectStorageFileDeleteService.delete(job.data.key);
		return 'Success';
	}
}
