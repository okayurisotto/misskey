import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { SwSubscriptionsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../error.js';

const res = z.object({
	userId: z.string(),
	endpoint: z.string(),
	sendReadMessage: z.boolean(),
});
export const meta = {
	tags: ['account'],
	requireCredential: true,
	description: 'Update push notification registration.',
	res: generateSchema(res),
	errors: {
		noSuchRegistration: {
			message: 'No such registration.',
			code: 'NO_SUCH_REGISTRATION',
			id: ' b09d8066-8064-5613-efb6-0e963b21d012',
		},
	},
} as const;

const paramDef_ = z.object({
	endpoint: z.string(),
	sendReadMessage: z.boolean().optional(),
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
			const swSubscription = await this.swSubscriptionsRepository.findOneBy({
				userId: me.id,
				endpoint: ps.endpoint,
			});

			if (swSubscription === null) {
				throw new ApiError(meta.errors.noSuchRegistration);
			}

			if (ps.sendReadMessage !== undefined) {
				swSubscription.sendReadMessage = ps.sendReadMessage;
			}

			await this.swSubscriptionsRepository.update(swSubscription.id, {
				sendReadMessage: swSubscription.sendReadMessage,
			});

			return {
				userId: swSubscription.userId,
				endpoint: swSubscription.endpoint,
				sendReadMessage: swSubscription.sendReadMessage,
			} satisfies z.infer<typeof res>;
		});
	}
}
