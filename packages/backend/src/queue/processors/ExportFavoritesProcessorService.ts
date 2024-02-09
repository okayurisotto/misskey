import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import { pick } from 'omick';
import { createTemp } from '@/misc/create-temp.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileAddService } from '@/core/DriveFileAddService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';

@Injectable()
export class ExportFavoritesProcessorService {
	private readonly logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly driveFileAddService: DriveFileAddService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('export-favorites');
	}

	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting favorites of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
		});
		if (user == null) {
			return;
		}

		// Create temp file
		const [path, cleanup] = await createTemp();

		this.logger.info(`Temp file is ${path}`);

		try {
			const favorites = await this.prismaService.client.noteFavorite.findMany({
				where: { userId: user.id },
				include: { note: { include: { user: true, poll: true } } },
				orderBy: { id: 'asc' },
			});

			const content = favorites.map((favorite) => {
				return {
					...pick(favorite, ['id', 'createdAt']),
					note: {
						...pick(favorite.note, [
							'id',
							'text',
							'createdAt',
							'fileIds',
							'replyId',
							'renoteId',
							'cw',
							'visibility',
							'visibleUserIds',
							'localOnly',
							'reactionAcceptance',
							'uri',
							'url',
						]),
						poll: favorite.note.poll,
						user: pick(favorite.note.user, [
							'id',
							'name',
							'username',
							'host',
							'uri',
						]),
					},
				};
			});

			fs.writeFileSync(path, JSON.stringify(content));

			this.logger.succ(`Exported to: ${path}`);

			const fileName =
				'favorites-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.json';
			const driveFile = await this.driveFileAddService.add({
				user,
				path,
				name: fileName,
				force: true,
				ext: 'json',
			});

			this.logger.succ(`Exported to: ${driveFile.id}`);
		} finally {
			cleanup();
		}
	}
}
