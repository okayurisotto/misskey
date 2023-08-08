import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { webhookEventTypes } from '@/models/entities/Webhook.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['webhooks'],
	requireCredential: true,
	kind: 'write:account',
	errors: {
		noSuchWebhook: {
			message: 'No such webhook.',
			code: 'NO_SUCH_WEBHOOK',
			id: 'fb0fea69-da18-45b1-828d-bd4fd1612518',
		},
	},
} as const;

export const paramDef = z.object({
	webhookId: MisskeyIdSchema,
	name: z.string().min(1).max(100),
	url: z.string().min(1).max(1024),
	secret: z.string().min(1).max(1024),
	on: z.array(z.enum(webhookEventTypes)),
	active: z.boolean(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const webhook = await this.prismaService.client.webhook.findFirst({
				where: {
					id: ps.webhookId,
					userId: me.id,
				},
			});

			if (webhook == null) {
				throw new ApiError(meta.errors.noSuchWebhook);
			}

			await this.prismaService.client.webhook.update({
				where: { id: webhook.id },
				data: {
					name: ps.name,
					url: ps.url,
					secret: ps.secret,
					on: ps.on,
					active: ps.active,
				},
			});

			const updated = await this.prismaService.client.webhook.findUniqueOrThrow(
				{ where: { id: ps.webhookId } },
			);

			this.globalEventService.publishInternalEvent('webhookUpdated', updated);
		});
	}
}
