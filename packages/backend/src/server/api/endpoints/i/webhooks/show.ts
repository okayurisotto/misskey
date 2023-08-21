import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchWebhook_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = z.record(z.string(), z.unknown());
export const meta = {
	tags: ['webhooks'],
	requireCredential: true,
	kind: 'read:account',
	res,
	errors: {noSuchWebhook:noSuchWebhook_},
} as const;

export const paramDef = z.object({
	webhookId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly prismaService: PrismaService) {
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

			return webhook satisfies z.infer<typeof res>;
		});
	}
}
