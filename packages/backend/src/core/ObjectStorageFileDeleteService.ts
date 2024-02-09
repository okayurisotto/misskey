import { Injectable } from '@nestjs/common';
import { DeleteObjectCommandInput } from '@aws-sdk/client-s3';
import Logger from '@/misc/logger.js';
import { MetaService } from '@/core/MetaService.js';
import { S3Service } from '@/core/S3Service.js';

@Injectable()
export class ObjectStorageFileDeleteService {
	private readonly deleteLogger;

	constructor(
		private readonly metaService: MetaService,
		private readonly s3Service: S3Service,
	) {
		const logger = new Logger('drive', 'blue');
		this.deleteLogger = logger.createSubLogger('delete');
	}

	public async delete(key: string): Promise<void> {
		const meta = await this.metaService.fetch();
		try {
			const param: DeleteObjectCommandInput = {
				Bucket: meta.objectStorageBucket ?? undefined,
				Key: key,
			};

			await this.s3Service.delete(meta, param);
		} catch (err: unknown) {
			if (
				err !== null &&
				typeof err === 'object' &&
				'name' in err &&
				err.name === 'NoSuchKey'
			) {
				this.deleteLogger.warn(
					`The object storage had no such key to delete: ${key}. Skipping this.`,
				);
				return;
			} else {
				throw new Error(
					`Failed to delete the file from the object storage with the given key: ${key}`,
					{
						cause: err,
					},
				);
			}
		}
	}
}
