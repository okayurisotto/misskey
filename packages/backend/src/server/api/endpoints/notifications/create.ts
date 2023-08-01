import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NotificationService } from '@/core/NotificationService.js';

export const meta = {
	tags: ['notifications'],
	requireCredential: true,
	kind: 'write:notifications',
	errors: {},
} as const;

const paramDef_ = z.object({
	body: z.string(),
	header: z.string().nullable().optional(),
	icon: z.string().nullable().optional(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(private notificationService: NotificationService) {
		super(meta, paramDef_, async (ps, user, token) => {
			this.notificationService.createNotification(user.id, 'app', {
				appAccessTokenId: token ? token.id : null,
				customBody: ps.body,
				customHeader: ps.header,
				customIcon: ps.icon,
			});
		});
	}
}
