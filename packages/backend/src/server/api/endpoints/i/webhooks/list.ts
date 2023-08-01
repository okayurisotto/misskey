import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { WebhooksRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown();
export const meta = {
	tags: ['webhooks', 'account'],
	requireCredential: true,
	kind: 'read:account',
	res,
} as const;

export const paramDef = z.object({});

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
	) {
		super(meta, paramDef, async (ps, me) => {
			const webhooks = await this.webhooksRepository.findBy({
				userId: me.id,
			});

			return webhooks satisfies z.infer<typeof res>;
		});
	}
}
