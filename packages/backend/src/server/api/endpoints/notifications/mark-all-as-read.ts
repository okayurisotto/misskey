import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NotificationService } from '@/core/NotificationService.js';

export const meta = {
	tags: ['notifications', 'account'],
	requireCredential: true,
	kind: 'write:notifications',
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private notificationService: NotificationService) {
		super(meta, paramDef, async (ps, me) => {
			this.notificationService.readAllNotification(me.id, true);
		});
	}
}
