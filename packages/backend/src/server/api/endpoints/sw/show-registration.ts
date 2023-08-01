import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { SwSubscriptionsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

const res = z.object({
	userId: z.string(),
	endpoint: z.string(),
	sendReadMessage: z.boolean(),
});
export const meta = {
	tags: ['account'],
	requireCredential: true,
	description: 'Check push notification registration exists.',
	res: generateSchema(res),
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
	typeof res
> {
	constructor(
		@Inject(DI.swSubscriptionsRepository)
		private swSubscriptionsRepository: SwSubscriptionsRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			// if already subscribed
			const exist = await this.swSubscriptionsRepository.findOneBy({
				userId: me.id,
				endpoint: ps.endpoint,
			});

			if (exist != null) {
				return {
					userId: exist.userId,
					endpoint: exist.endpoint,
					sendReadMessage: exist.sendReadMessage,
				};
			}

			return null satisfies z.infer<typeof res>;
		});
	}
}
