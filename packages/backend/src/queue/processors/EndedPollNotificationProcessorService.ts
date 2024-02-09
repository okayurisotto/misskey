import { Injectable } from '@nestjs/common';
import { NotificationService } from '@/core/NotificationService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type * as Bull from 'bullmq';
import type { EndedPollNotificationJobData } from '../types.js';

@Injectable()
export class EndedPollNotificationProcessorService {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly prismaService: PrismaService,
	) {}

	public async process(
		job: Bull.Job<EndedPollNotificationJobData>,
	): Promise<void> {
		const note = await this.prismaService.client.note.findUnique({
			where: { id: job.data.noteId, hasPoll: true },
			include: { pollVotes: { where: { user: { host: null } } } },
		});
		if (note === null) return;

		const votes = note.pollVotes;
		const userIds = [...new Set([note.userId, ...votes.map((v) => v.userId)])];

		await Promise.all(
			userIds.map(async (userId) => {
				await this.notificationService.createNotification(userId, 'pollEnded', {
					noteId: note.id,
				});
			}),
		);
	}
}
