import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import type Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { createTemp } from '@/misc/create-temp.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';
import type { note, note_favorite, poll, user } from '@prisma/client';

@Injectable()
export class ExportFavoritesProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly driveService: DriveService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('export-favorites');
	}

	@bindThis
	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting favorites of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({ where: { id: job.data.user.id } });
		if (user == null) {
			return;
		}

		// Create temp file
		const [path, cleanup] = await createTemp();

		this.logger.info(`Temp file is ${path}`);

		try {
			const stream = fs.createWriteStream(path, { flags: 'a' });

			const write = (text: string): Promise<void> => {
				return new Promise<void>((res, rej) => {
					stream.write(text, err => {
						if (err) {
							this.logger.error(err);
							rej(err);
						} else {
							res();
						}
					});
				});
			};

			await write('[');

			let exportedFavoritesCount = 0;
			let cursor: note_favorite['id'] | null = null;

			while (true) {
				const favorites: (note_favorite & { note: note & { user: user } })[] = await this.prismaService.client.note_favorite.findMany({
					where: {
						userId: user.id,
						...(cursor ? { id: { gt: cursor } } : {}),
					},
					take: 100,
					orderBy: { id: 'asc' },
					include: { note: { include: { user: true } } },
				});

				if (favorites.length === 0) {
					job.updateProgress(100);
					break;
				}

				cursor = favorites.at(-1)?.id ?? null;

				for (const favorite of favorites) {
					let poll: poll | undefined;
					if (favorite.note.hasPoll) {
						poll = await this.prismaService.client.poll.findUniqueOrThrow({ where: { noteId: favorite.note.id } });
					}
					const content = JSON.stringify(serialize(favorite, poll));
					const isFirst = exportedFavoritesCount === 0;
					await write(isFirst ? content : ',\n' + content);
					exportedFavoritesCount++;
				}

				const total = await this.prismaService.client.note_favorite.count({
					where: {
						userId: user.id,
					},
				});

				job.updateProgress(exportedFavoritesCount / total);
			}

			await write(']');

			stream.end();
			this.logger.succ(`Exported to: ${path}`);

			const fileName = 'favorites-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.json';
			const driveFile = await this.driveService.addFile({ user, path, name: fileName, force: true, ext: 'json' });

			this.logger.succ(`Exported to: ${driveFile.id}`);
		} finally {
			cleanup();
		}
	}
}

function serialize(favorite: note_favorite & { note: note & { user: user } }, poll: poll | null = null): Record<string, unknown> {
	return {
		id: favorite.id,
		createdAt: favorite.createdAt,
		note: {
			id: favorite.note.id,
			text: favorite.note.text,
			createdAt: favorite.note.createdAt,
			fileIds: favorite.note.fileIds,
			replyId: favorite.note.replyId,
			renoteId: favorite.note.renoteId,
			poll: poll,
			cw: favorite.note.cw,
			visibility: favorite.note.visibility,
			visibleUserIds: favorite.note.visibleUserIds,
			localOnly: favorite.note.localOnly,
			reactionAcceptance: favorite.note.reactionAcceptance,
			uri: favorite.note.uri,
			url: favorite.note.url,
			user: {
				id: favorite.note.user.id,
				name: favorite.note.user.name,
				username: favorite.note.user.username,
				host: favorite.note.user.host,
				uri: favorite.note.user.uri,
			},
		},
	};
}
