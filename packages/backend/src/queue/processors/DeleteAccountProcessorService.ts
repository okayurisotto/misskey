import { Injectable } from '@nestjs/common';
import type Logger from '@/misc/logger.js';
import { DriveService } from '@/core/DriveService.js';
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
		this.logger =
			this.queueLoggerService.logger.createSubLogger('delete-account');
	}

	async deleteNotes(notes: note[]): Promise<void> {
		await this.prismaService.client.note.deleteMany({
			where: { id: { in: notes.map(({ id }) => id) } },
		});
	}

	async unindexNotes(notes: note[]): Promise<void> {
		await Promise.all(
			notes.map(async (note) => {
				await this.searchService.unindexNote(note);
			}),
		);
	}

	async deleteFiles(files: drive_file[]): Promise<void> {
		await Promise.all(
			files.map(async (file) => {
				await this.driveService.deleteFileSync(file);
			}),
		);
	}

	@bindThis
	public async process(
		job: Bull.Job<DbUserDeleteJobData>,
	): Promise<string | void> {
		this.logger.info(`Deleting account of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: {
				note: true,
				drive_file_drive_file_userIdTouser: true,
				user_profile: true,
			},
		});
		if (user === null) return;
		if (user.user_profile === null) throw new Error();

		await Promise.all([
			await Promise.all([
				this.deleteNotes(user.note),
				this.unindexNotes(user.note),
			]).then(() => {
				this.logger.succ('All of notes deleted');
			}),
			this.deleteFiles(user.drive_file_drive_file_userIdTouser).then(() => {
				this.logger.succ('All of files deleted');
			}),
		]);

		// Send email notification
		const profile = user.user_profile;
		if (profile.email && profile.emailVerified) {
			await this.emailService.sendEmail(
				profile.email,
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
