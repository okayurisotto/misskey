import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import { pick } from 'omick';
import type Logger from '@/misc/logger.js';
import { createTemp } from '@/misc/create-temp.js';
import { DriveFileEntityPackService } from '@/core/entities/DriveFileEntityPackService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { unique } from '@/misc/prelude/array.js';
import { DriveFileAddService } from '@/core/DriveFileAddService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';

@Injectable()
export class ExportNotesProcessorService {
	private readonly logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly driveFileEntityPackService: DriveFileEntityPackService,
		private readonly prismaService: PrismaService,
		private readonly driveFileAddService: DriveFileAddService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('export-notes');
	}

	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting notes of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: { note: { include: { poll: true }, orderBy: { id: 'asc' } } },
		});
		if (user === null) return;

		const notes = user.note;
		const allFileIds = unique(notes.map((note) => note.fileIds).flat());
		const allFiles =
			await this.driveFileEntityPackService.packManyByIdsMap(allFileIds);
		const content = notes.map((note) => ({
			...pick(note, [
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
			]),
			files: note.fileIds.map((fileId) => allFiles.get(fileId)),
			poll: note.poll,
		}));

		// Create temp file
		const [path, cleanup] = await createTemp();
		this.logger.info(`Temp file is ${path}`);
		fs.writeFileSync(path, JSON.stringify(content));
		this.logger.succ(`Exported to: ${path}`);

		const fileName =
			'notes-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.json';
		const driveFile = await this.driveFileAddService.add({
			user,
			path,
			name: fileName,
			force: true,
			ext: 'json',
		});
		this.logger.succ(`Exported to: ${driveFile.id}`);

		cleanup();
	}
}
