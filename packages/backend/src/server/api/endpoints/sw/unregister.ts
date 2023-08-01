import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { SwSubscriptionsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['account'],
	requireCredential: false,
	description: 'Unregister from receiving push notifications.',
} as const;

export const paramDef = z.object({
	endpoint: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.swSubscriptionsRepository)
		private swSubscriptionsRepository: SwSubscriptionsRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.swSubscriptionsRepository.delete({
				...(me ? { userId: me.id } : {}),
				endpoint: ps.endpoint,
			});
		});
	}
}
