import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { QueueService } from '@/core/QueueService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({
	type: z.enum(['deliver', 'inbox']),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private moderationLogService: ModerationLogService,
		private queueService: QueueService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const jobs = (
				await Promise.all([
					ps.type === 'deliver'
						? this.queueService.deliverQueue.getDelayed()
						: [],
					ps.type === 'inbox' ? this.queueService.inboxQueue.getDelayed() : [],
				])
			).flat();

			await Promise.all(
				jobs.map(async (job) => {
					try {
						await job.promote();
					} catch (e) {
						if (
							e instanceof Error &&
							e.message.includes('not in a delayed state')
						) {
							// pass
						} else {
							throw e;
						}
					}
				}),
			);

			await this.moderationLogService.insertModerationLog(me, 'promoteQueue');
		});
	}
}
