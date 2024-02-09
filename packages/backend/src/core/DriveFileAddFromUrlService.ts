import { Injectable } from '@nestjs/common';
import Logger from '@/misc/logger.js';
import { createTemp } from '@/misc/create-temp.js';
import { DownloadService } from '@/core/DownloadService.js';
import { DriveFileAddService } from './DriveFileAddService.js';
import type { DriveFile, DriveFolder, user } from '@prisma/client';

type UploadFromUrlArgs = {
	url: string;
	user: { id: user['id']; host: user['host'] } | null;
	folderId?: DriveFolder['id'] | null;
	uri?: string | null;
	sensitive?: boolean;
	force?: boolean;
	isLink?: boolean;
	comment?: string | null;
	requestIp?: string | null;
	requestHeaders?: Record<string, string> | null;
};

@Injectable()
export class DriveFileAddFromUrlService {
	private readonly downloaderLogger;

	constructor(
		private readonly downloadService: DownloadService,
		private readonly driveFileAddService: DriveFileAddService,
	) {
		const logger = new Logger('drive', 'blue');
		this.downloaderLogger = logger.createSubLogger('downloader');
	}

	public async addFromUrl({
		url,
		user,
		folderId = null,
		uri = null,
		sensitive = false,
		force = false,
		isLink = false,
		comment = null,
		requestIp = null,
		requestHeaders = null,
	}: UploadFromUrlArgs): Promise<DriveFile> {
		// Create temp file
		const [path, cleanup] = await createTemp();

		try {
			// write content at URL to temp file
			const { filename: name } = await this.downloadService.downloadUrl(
				url,
				path,
			);

			const driveFile = await this.driveFileAddService.add({
				user,
				path,
				name,
				comment: comment !== null && name === comment ? null : comment, // If the comment is same as the name, skip comment. (image.name is passed in when receiving attachment)
				folderId,
				force,
				isLink,
				url,
				uri,
				sensitive,
				requestIp,
				requestHeaders,
			});
			this.downloaderLogger.succ(`Got: ${driveFile.id}`);
			return driveFile;
		} catch (err) {
			this.downloaderLogger.error(`Failed to create drive file: ${err}`, {
				url: url,
				e: err,
			});
			throw err;
		} finally {
			cleanup();
		}
	}
}
