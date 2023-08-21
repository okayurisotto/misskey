import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { tooManyWebhooks } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { webhookEventTypes } from '@/models/entities/Webhook.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '@/server/api/error.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.record(z.string(), z.unknown());
export const meta = {
	tags: ['webhooks'],
	requireCredential: true,
	kind: 'write:account',
	res,
	errors: {tooManyWebhooks:tooManyWebhooks},
} as const;

export const paramDef = z.object({
	name: z.string().min(1).max(100),
	url: z.string().min(1).max(1024),
	secret: z.string().min(1).max(1024),
	on: z.array(z.enum(webhookEventTypes)),
});

// TODO: ロジックをサービスに切り出す

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const currentWebhooksCount =
				await this.prismaService.client.webhook.count({
					where: { userId: me.id },
				});
			if (
				currentWebhooksCount >
				(await this.roleService.getUserPolicies(me.id)).webhookLimit
			) {
				throw new ApiError(meta.errors.tooManyWebhooks);
			}

			const webhook = await this.prismaService.client.webhook.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me.id,
					name: ps.name,
					url: ps.url,
					secret: ps.secret,
					on: ps.on,
				},
			});

			this.globalEventService.publishInternalEvent('webhookCreated', webhook);

			return webhook satisfies z.infer<typeof res>;
		});
	}
}
