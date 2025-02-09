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

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly moderationLogService: ModerationLogService,
		private readonly queueService: QueueService,
	) {
		super(meta, paramDef, async (ps, me) => {
			this.queueService.destroy();
			await this.moderationLogService.insertModerationLog(me, 'clearQueue');
		});
	}
}
