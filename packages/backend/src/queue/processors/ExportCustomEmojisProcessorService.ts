import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import mime from 'mime-types';
import archiver from 'archiver';
import { z } from 'zod';
import { createTemp, createTempDir } from '@/misc/create-temp.js';
import { DownloadService } from '@/core/DownloadService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { DriveFileAddService } from '@/core/DriveFileAddService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { ExportedCustomEmojisMetaSchema } from './ImportCustomEmojisProcessorService.js';

@Injectable()
export class ExportCustomEmojisProcessorService {
	private readonly logger;

	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly downloadService: DownloadService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly driveFileAddService: DriveFileAddService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger(
			'export-custom-emojis',
		);
	}

	public async process(job: Bull.Job): Promise<void> {
		this.logger.info('Exporting custom emojis ...');

		const job_ = z
			.object({ data: z.object({ user: z.object({ id: z.string() }) }) })
			.parse(job);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job_.data.user.id },
		});
		if (user === null) return;

		const [path, cleanup] = await createTempDir();

		this.logger.info(`Temp dir is ${path}`);

		// Download all custom emojis

		const customEmojis = await this.prismaService.client.customEmoji.findMany({
			where: { host: null },
			orderBy: { id: 'asc' },
		});

		const customEmoji_ = await Promise.all(
			customEmojis
				.filter((emoji) => {
					if (!/^[a-zA-Z0-9_]+$/.test(emoji.name)) {
						this.logger.error(`invalid emoji name: ${emoji.name}`);
						return false;
					}
					return true;
				})
				.map((emoji) => {
					const ext = mime.extension(emoji.type ?? 'image/png');
					const fileName = emoji.name + (ext ? '.' + ext : '');
					const emojiPath = path + '/' + fileName;
					return { emoji, fileName, emojiPath };
				})
				.map(async ({ emoji, emojiPath, fileName }) => {
					fs.writeFileSync(emojiPath, '', 'binary');
					let downloaded = false;

					try {
						await this.downloadService.downloadUrl(
							emoji.originalUrl,
							emojiPath,
						);
						downloaded = true;
					} catch (e) {
						// TODO: 何度か再試行

						if (e instanceof Error) {
							this.logger.error(e);
						} else if (typeof e === 'string') {
							this.logger.error(new Error(e));
						} else {
							// TODO
						}
					} finally {
						if (!downloaded) {
							fs.unlinkSync(emojiPath);
						}
					}

					return { emoji, fileName, downloaded };
				}),
		);

		// Write meta.json

		const metaPath = path + '/meta.json';

		const emojis = customEmoji_.map(({ emoji, fileName, downloaded }) => {
			return {
				emoji: { ...emoji, updatedAt: emoji.updatedAt?.toISOString() ?? null },
				fileName: fileName,
				downloaded: downloaded,
			};
		});

		const meta: z.infer<typeof ExportedCustomEmojisMetaSchema> = {
			metaVersion: 2,
			host: this.configLoaderService.data.host,
			exportedAt: new Date().toString(),
			emojis,
		};

		fs.writeFileSync(metaPath, JSON.stringify(meta));

		// Create archive

		const [archivePath, archiveCleanup] = await createTemp();
		const archiveStream = fs.createWriteStream(archivePath);
		const archive = archiver('zip', { zlib: { level: 0 } });

		archive.pipe(archiveStream);
		archive.directory(path, false);
		await archive.finalize();

		await new Promise<void>((resolve) => {
			archiveStream.on('close', async () => {
				this.logger.succ(`Exported to: ${archivePath}`);

				const fileName =
					'custom-emojis-' +
					dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') +
					'.zip';
				const driveFile = await this.driveFileAddService.add({
					user,
					path: archivePath,
					name: fileName,
					force: true,
				});

				this.logger.succ(`Exported to: ${driveFile.id}`);
				cleanup();
				archiveCleanup();
				resolve();
			});
		});
	}
}
