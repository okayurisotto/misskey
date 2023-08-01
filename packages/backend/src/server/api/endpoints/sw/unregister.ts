import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { SwSubscriptionsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['account'],
	requireCredential: false,
	description: 'Unregister from receiving push notifications.',
} as const;

const paramDef_ = z.object({
	endpoint: z.string(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.swSubscriptionsRepository)
		private swSubscriptionsRepository: SwSubscriptionsRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			await this.swSubscriptionsRepository.delete({
				...(me ? { userId: me.id } : {}),
				endpoint: ps.endpoint,
			});
		});
	}
}
