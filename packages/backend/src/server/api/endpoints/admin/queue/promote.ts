import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { QueueService } from '@/core/QueueService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

const paramDef_ = z.object({
	type: z.enum(['deliver', 'inbox']),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		private moderationLogService: ModerationLogService,
		private queueService: QueueService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			let delayedQueues;

			switch (ps.type) {
				case 'deliver':
					delayedQueues = await this.queueService.deliverQueue.getDelayed();
					for (
						let queueIndex = 0;
						queueIndex < delayedQueues.length;
						queueIndex++
					) {
						const queue = delayedQueues[queueIndex];
						try {
							await queue.promote();
						} catch (e) {
							if (e instanceof Error) {
								if (e.message.indexOf('not in a delayed state') !== -1) {
									throw e;
								}
							} else {
								throw e;
							}
						}
					}
					break;

				case 'inbox':
					delayedQueues = await this.queueService.inboxQueue.getDelayed();
					for (
						let queueIndex = 0;
						queueIndex < delayedQueues.length;
						queueIndex++
					) {
						const queue = delayedQueues[queueIndex];
						try {
							await queue.promote();
						} catch (e) {
							if (e instanceof Error) {
								if (e.message.indexOf('not in a delayed state') !== -1) {
									throw e;
								}
							} else {
								throw e;
							}
						}
					}
					break;
			}

			this.moderationLogService.insertModerationLog(me, 'promoteQueue');
		});
	}
}
