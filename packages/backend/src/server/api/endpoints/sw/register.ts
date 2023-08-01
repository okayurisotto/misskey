import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import type { SwSubscriptionsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { DI } from '@/di-symbols.js';

const res = z.object({
	state: z.enum(['already-subscribed', 'subscribed']).optional(),
	key: z.string().nullable(),
	userId: z.string(),
	endpoint: z.string(),
	sendReadMessage: z.boolean(),
});
export const meta = {
	tags: ['account'],
	requireCredential: true,
	description: 'Register to receive push notifications.',
	res,
} as const;

export const paramDef = z.object({
	endpoint: z.string(),
	auth: z.string(),
	publickey: z.string(),
	sendReadMessage: z.boolean().default(false),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.swSubscriptionsRepository)
		private swSubscriptionsRepository: SwSubscriptionsRepository,

		private idService: IdService,
		private metaService: MetaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// if already subscribed
			const exist = await this.swSubscriptionsRepository.findOneBy({
				userId: me.id,
				endpoint: ps.endpoint,
				auth: ps.auth,
				publickey: ps.publickey,
			});

			const instance = await this.metaService.fetch(true);

			if (exist != null) {
				return {
					state: 'already-subscribed' as const,
					key: instance.swPublicKey,
					userId: me.id,
					endpoint: exist.endpoint,
					sendReadMessage: exist.sendReadMessage,
				};
			}

			await this.swSubscriptionsRepository.insert({
				id: this.idService.genId(),
				createdAt: new Date(),
				userId: me.id,
				endpoint: ps.endpoint,
				auth: ps.auth,
				publickey: ps.publickey,
				sendReadMessage: ps.sendReadMessage,
			});

			return {
				state: 'subscribed' as const,
				key: instance.swPublicKey,
				userId: me.id,
				endpoint: ps.endpoint,
				sendReadMessage: ps.sendReadMessage,
			} satisfies z.infer<typeof res>;
		});
	}
}
