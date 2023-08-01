import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { WebhooksRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown();
export const meta = {
	tags: ['webhooks', 'account'],
	requireCredential: true,
	kind: 'read:account',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.webhooksRepository)
		private webhooksRepository: WebhooksRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const webhooks = await this.webhooksRepository.findBy({
				userId: me.id,
			});

			return webhooks satisfies z.infer<typeof res>;
		});
	}
}
