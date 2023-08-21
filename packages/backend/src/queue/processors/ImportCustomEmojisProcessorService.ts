import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { ZipReader } from 'slacc';
import type Logger from '@/logger.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { createTempDir } from '@/misc/create-temp.js';
import { DriveService } from '@/core/DriveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData } from '../types.js';

// TODO: 名前衝突時の動作を選べるようにする
@Injectable()
export class ImportCustomEmojisProcessorService {
	private logger: Logger;

	constructor(
		private customEmojiService: CustomEmojiService,
		private driveService: DriveService,
		private downloadService: DownloadService,
		private queueLoggerService: QueueLoggerService,
		private prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('import-custom-emojis');
	}

	@bindThis
	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		this.logger.info('Importing custom emojis ...');

		const file = await this.prismaService.client.drive_file.findUnique({
			where: {
				id: job.data.fileId,
			},
		});
		if (file == null) {
			return;
		}

		const [path, cleanup] = await createTempDir();

		this.logger.info(`Temp dir is ${path}`);

		const destPath = path + '/emojis.zip';

		try {
			fs.writeFileSync(destPath, '', 'binary');
			await this.downloadService.downloadUrl(file.url, destPath);
		} catch (e) { // TODO: 何度か再試行
			if (e instanceof Error || typeof e === 'string') {
				this.logger.error(e);
			}
			throw e;
		}

		const outputPath = path + '/emojis';
		try {
			this.logger.succ(`Unzipping to ${outputPath}`);
			ZipReader.withDestinationPath(outputPath).viaBuffer(await fs.promises.readFile(destPath));
			const metaRaw = fs.readFileSync(outputPath + '/meta.json', 'utf-8');
			const meta = JSON.parse(metaRaw);

			for (const record of meta.emojis) {
				if (!record.downloaded) continue;
				if (!/^[a-zA-Z0-9_]+?([a-zA-Z0-9.]+)?$/.test(record.fileName)) {
					this.logger.error(`invalid filename: ${record.fileName}`);
					continue;
				}
				const emojiInfo = record.emoji;
				if (!/^[a-zA-Z0-9_]+$/.test(emojiInfo.name)) {
					this.logger.error(`invalid emojiname: ${emojiInfo.name}`);
					continue;
				}
				const emojiPath = outputPath + '/' + record.fileName;
				const emoji = await this.prismaService.client.emoji.findFirstOrThrow({
					where: {
						name: emojiInfo.name,
					},
				});
				await this.prismaService.client.emoji.delete({
					where: { id: emoji.id }
				});
				const driveFile = await this.driveService.addFile({
					user: null,
					path: emojiPath,
					name: record.fileName,
					force: true,
				});
				await this.customEmojiService.add({
					name: emojiInfo.name,
					category: emojiInfo.category,
					host: null,
					aliases: emojiInfo.aliases,
					driveFile,
					license: emojiInfo.license,
					isSensitive: emojiInfo.isSensitive,
					localOnly: emojiInfo.localOnly,
					roleIdsThatCanBeUsedThisEmojiAsReaction: [],
				});
			}

			cleanup();

			this.logger.succ('Imported');
		} catch (e) {
			if (e instanceof Error || typeof e === 'string') {
				this.logger.error(e);
			}
			cleanup();
			throw e;
		}
	}
}
