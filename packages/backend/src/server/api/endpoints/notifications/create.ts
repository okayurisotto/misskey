import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NotificationService } from '@/core/NotificationService.js';

export const meta = {
	tags: ['notifications'],
	requireCredential: true,
	kind: 'write:notifications',
} as const;

export const paramDef = z.object({
	body: z.string(),
	header: z.string().nullable().optional(),
	icon: z.string().nullable().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly notificationService: NotificationService) {
		super(meta, paramDef, async (ps, user, token) => {
			this.notificationService.createNotification(user.id, 'app', {
				appAccessTokenId: token ? token.id : null,
				customBody: ps.body,
				customHeader: ps.header,
				customIcon: ps.icon,
			});
		});
	}
}
