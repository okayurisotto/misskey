import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchWebhook } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['webhooks'],
	requireCredential: true,
	kind: 'write:account',
	errors: { noSuchWebhook: noSuchWebhook },
} as const;

export const paramDef = z.object({
	webhookId: MisskeyIdSchema,
});

// TODO: ロジックをサービスに切り出す

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
			const webhook = await this.prismaService.client.webhook.findUnique({
				where: {
					id: ps.webhookId,
					userId: me.id,
				},
			});

			if (webhook == null) {
				throw new ApiError(meta.errors.noSuchWebhook);
			}

			await this.prismaService.client.webhook.delete({
				where: { id: webhook.id },
			});

			this.globalEventService.publishInternalEvent('webhookDeleted', webhook);
		});
	}
}
