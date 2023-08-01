import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import type { WebhooksRepository } from '@/models/index.js';
import { webhookEventTypes } from '@/models/entities/Webhook.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '@/server/api/error.js';

const res = z.unknown();
export const meta = {
	tags: ['webhooks'],
	requireCredential: true,
	kind: 'write:account',
	res,
	errors: {
		tooManyWebhooks: {
			message: 'You cannot create webhook any more.',
			code: 'TOO_MANY_WEBHOOKS',
			id: '87a9bb19-111e-4e37-81d3-a3e7426453b0',
		},
	},
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
		@Inject(DI.webhooksRepository)
		private webhooksRepository: WebhooksRepository,

		private idService: IdService,
		private globalEventService: GlobalEventService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const currentWebhooksCount = await this.webhooksRepository.countBy({
				userId: me.id,
			});
			if (
				currentWebhooksCount >
				(await this.roleService.getUserPolicies(me.id)).webhookLimit
			) {
				throw new ApiError(meta.errors.tooManyWebhooks);
			}

			const webhook = await this.webhooksRepository
				.insert({
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me.id,
					name: ps.name,
					url: ps.url,
					secret: ps.secret,
					on: ps.on,
				})
				.then((x) => this.webhooksRepository.findOneByOrFail(x.identifiers[0]));

			this.globalEventService.publishInternalEvent('webhookCreated', webhook);

			return webhook satisfies z.infer<typeof res>;
		});
	}
}
