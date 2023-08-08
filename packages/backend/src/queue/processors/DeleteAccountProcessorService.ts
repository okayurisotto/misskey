import { Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import type { Note } from '@/models/entities/Note.js';
import { EmailService } from '@/core/EmailService.js';
import { bindThis } from '@/decorators.js';
import { SearchService } from '@/core/SearchService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserDeleteJobData } from '../types.js';
import type { drive_file, note } from '@prisma/client';

@Injectable()
export class DeleteAccountProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly driveService: DriveService,
		private readonly emailService: EmailService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly searchService: SearchService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('delete-account');
	}

	@bindThis
	public async process(job: Bull.Job<DbUserDeleteJobData>): Promise<string | void> {
		this.logger.info(`Deleting account of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({ where: { id: job.data.user.id } });
		if (user == null) {
			return;
		}

		{
			// Delete notes
			let cursor: Note['id'] | null = null;

			while (true) {
				const notes: note[] = await this.prismaService.client.note.findMany({
					where: {
						userId: user.id,
						...(cursor ? { id: { gt: cursor } } : {}),
					},
					take: 100,
					orderBy: { id: 'asc' },
				});

				if (notes.length === 0) {
					break;
				}

				cursor = notes.at(-1)?.id ?? null;

				await this.prismaService.client.note.deleteMany({
					where: { id: { in: notes.map(note => note.id) } },
				});

				for (const note of notes) {
					await this.searchService.unindexNote(note);
				}
			}

			this.logger.succ('All of notes deleted');
		}

		{
			// Delete files
			let cursor: DriveFile['id'] | null = null;

			while (true) {
				const files: drive_file[] = await this.prismaService.client.drive_file.findMany({
					where: {
						userId: user.id,
						...(cursor ? { id: { gt: cursor } } : {}),
					},
					take: 10,
					orderBy: { id: 'asc' },
				});

				if (files.length === 0) {
					break;
				}

				cursor = files.at(-1)?.id ?? null;

				for (const file of files) {
					await this.driveService.deleteFileSync(file);
				}
			}

			this.logger.succ('All of files deleted');
		}

		{
			// Send email notification
			const profile = await this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: user.id } });
			if (profile.email && profile.emailVerified) {
				await this.emailService.sendEmail(
					profile.email,
					'Account deleted',
					'Your account has been deleted.',
					'Your account has been deleted.',
				);
			}
		}

		// soft指定されている場合は物理削除しない
		if (job.data.soft) {
			// nop
		} else {
			await this.prismaService.client.user.delete({
				where: { id: job.data.user.id },
			});
		}

		return 'Account deleted';
	}
}
