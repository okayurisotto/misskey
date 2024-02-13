import { Injectable } from '@nestjs/common';
import { EmailService } from '@/core/EmailService.js';
import { SearchService } from '@/core/SearchService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileDeleteService } from '@/core/DriveFileDeleteService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserDeleteJobData } from '../types.js';
import type { DriveFile, Note } from '@prisma/client';

@Injectable()
export class DeleteAccountProcessorService {
	private readonly logger;

	constructor(
		private readonly emailService: EmailService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly searchService: SearchService,
		private readonly prismaService: PrismaService,
		private readonly driveFileDeleteService: DriveFileDeleteService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('delete-account');
	}

	private async deleteNotes(notes: Note[]): Promise<void> {
		await this.prismaService.client.note.deleteMany({
			where: { id: { in: notes.map(({ id }) => id) } },
		});
	}

	private async unindexNotes(notes: Note[]): Promise<void> {
		await Promise.all(
			notes.map(async (note) => {
				await this.searchService.unindexNote(note);
			}),
		);
	}

	private async deleteFiles(files: DriveFile[]): Promise<void> {
		await Promise.all(
			files.map(async (file) => {
				await this.driveFileDeleteService.delete(file);
			}),
		);
	}

	public async process(
		job: Bull.Job<DbUserDeleteJobData>,
	): Promise<string | void> {
		this.logger.info(`Deleting account of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: {
				notes: true,
				driveFiles: true,
				userProfile: true,
			},
		});
		if (user === null) return;
		if (user.userProfile === null) throw new Error();

		await Promise.all([
			await Promise.all([
				this.deleteNotes(user.notes),
				this.unindexNotes(user.notes),
			]).then(() => {
				this.logger.succ('All of notes deleted');
			}),
			this.deleteFiles(user.driveFiles).then(() => {
				this.logger.succ('All of files deleted');
			}),
		]);

		// Send email notification
		if (user.userProfile.email && user.userProfile.emailVerified) {
			await this.emailService.sendEmail(
				user.userProfile.email,
				'Account deleted',
				'Your account has been deleted.',
				'Your account has been deleted.',
			);
		}

		// soft指定されている場合は物理削除しない
		if (job.data.soft) {
			// nop
		} else {
			await this.prismaService.client.user.delete({
				where: { id: user.id },
			});
		}

		this.logger.info(`Account deleted: ${user.id}`);
	}
}
