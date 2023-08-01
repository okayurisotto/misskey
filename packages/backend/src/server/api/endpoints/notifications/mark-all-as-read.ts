import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { NotificationService } from '@/core/NotificationService.js';

export const meta = {
	tags: ['notifications', 'account'],
	requireCredential: true,
	kind: 'write:notifications',
} as const;

const paramDef_ = z.object({});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(private notificationService: NotificationService) {
		super(meta, paramDef_, async (ps, me) => {
			this.notificationService.readAllNotification(me.id, true);
		});
	}
}
