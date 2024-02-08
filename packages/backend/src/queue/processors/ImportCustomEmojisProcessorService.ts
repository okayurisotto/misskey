import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { ZipReader } from 'slacc';
import { z } from 'zod';
import { pick } from 'omick';
import type Logger from '@/misc/logger.js';
import { createTempDir } from '@/misc/create-temp.js';
import { DownloadService } from '@/core/DownloadService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { unique } from '@/misc/prelude/array.js';
import { DriveFileAddService } from '@/core/DriveFileAddService.js';
import { CustomEmojiAddService } from '@/core/CustomEmojiAddService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData } from '../types.js';

export const ExportedCustomEmojisMetaSchema = z.object({
	metaVersion: z.literal(2),
	host: z.string(),
	exportedAt: z.string().datetime(),
	emojis: z
		.object({
			emoji: z.object({
				id: z.string(),
				updatedAt: z.string().datetime().nullable(),
				name: z.string().regex(/^[a-zA-Z0-9_]+$/),
				host: z.string().nullable(),
				originalUrl: z.string(),
				uri: z.string().nullable(),
				type: z.string().nullable(),
				aliases: z.string().array(),
				category: z.string().nullable(),
				publicUrl: z.string(),
				license: z.string().nullable(),
				localOnly: z.boolean(),
				isSensitive: z.boolean(),
				roleIdsThatCanBeUsedThisEmojiAsReaction: z.string().array(),
			}),
			fileName: z.string().regex(/^[a-zA-Z0-9_]+?([a-zA-Z0-9.]+)?$/),
			downloaded: z.boolean(),
		})
		.array(),
});

@Injectable()
export class ImportCustomEmojisProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly customEmojiAddService: CustomEmojiAddService,
		private readonly downloadService: DownloadService,
		private readonly driveFileAddService: DriveFileAddService,
		private readonly prismaService: PrismaService,
		private readonly queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger(
			'import-custom-emojis',
		);
	}

	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		this.logger.info('Importing custom emojis ...');

		const file = await this.prismaService.client.driveFile.findUnique({
			where: { id: job.data.fileId },
		});
		if (file === null) return;

		const [path, cleanup] = await createTempDir();

		this.logger.info(`Temp dir is ${path}`);

		const destPath = path + '/emojis.zip';

		try {
			fs.writeFileSync(destPath, '', 'binary');
			await this.downloadService.downloadUrl(file.url, destPath);
		} catch (e) {
			// TODO: 何度か再試行
			if (e instanceof Error || typeof e === 'string') {
				this.logger.error(e);
			}
			throw e;
		}

		const outputPath = path + '/emojis';
		try {
			this.logger.succ(`Unzipping to ${outputPath}`);

			const buffer = await fs.promises.readFile(destPath);
			ZipReader.withDestinationPath(outputPath).viaBuffer(buffer);

			const metaRaw = fs.readFileSync(outputPath + '/meta.json', 'utf-8');
			const meta = ExportedCustomEmojisMetaSchema.parse(JSON.parse(metaRaw));

			// ダウンロードされZipファイルに画像が含まれるもののみに絞り込む
			const emojis = meta.emojis.filter(({ downloaded }) => downloaded);

			// 同じ名前の既存のカスタム絵文字をデータベースから削除
			// TODO: 削除するかどうか選べるようにする
			await this.prismaService.client.customEmoji.deleteMany({
				where: { name: { in: unique(emojis).map(({ emoji }) => emoji.name) } },
			});

			// 画像をドライブに追加した上でそれをカスタム絵文字として登録
			await Promise.all(
				meta.emojis.map(async (record) => {
					const driveFile = await this.driveFileAddService.add({
						user: null,
						path: outputPath + '/' + record.fileName,
						name: record.fileName,
						force: true,
					});

					await this.customEmojiAddService.add({
						...pick(record.emoji, [
							'name',
							'category',
							'aliases',
							'license',
							'isSensitive',
							'localOnly',
						]),
						host: null,
						driveFile,
						roleIdsThatCanBeUsedThisEmojiAsReaction: [],
					});
				}),
			);

			this.logger.succ('Imported');
		} catch (e) {
			if (e instanceof Error || typeof e === 'string') {
				this.logger.error(e);
			}
			throw e;
		} finally {
			cleanup();
		}
	}
}
