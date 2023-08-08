import { Injectable } from '@nestjs/common';
import { NotificationService } from '@/core/NotificationService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type * as Bull from 'bullmq';
import type { EndedPollNotificationJobData } from '../types.js';

@Injectable()
export class EndedPollNotificationProcessorService {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async process(job: Bull.Job<EndedPollNotificationJobData>): Promise<void> {
		const note = await this.prismaService.client.note.findUnique({ where: { id: job.data.noteId } });
		if (note == null || !note.hasPoll) {
			return;
		}

		const votes = await this.prismaService.client.poll_vote.findMany({
			where: {
				noteId: note.id,
				user: { host: null },
			},
		});

		const userIds = [...new Set([note.userId, ...votes.map(v => v.userId)])];

		for (const userId of userIds) {
			this.notificationService.createNotification(
				userId,
				'pollEnded',
				{ noteId: note.id },
			);
		}
	}
}
