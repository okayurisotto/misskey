import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchRegistration } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';
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
	res,
	errors: { noSuchRegistration: noSuchRegistration },
} as const;

export const paramDef = z.object({
	endpoint: z.string(),
	sendReadMessage: z.boolean().optional(),
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
			const swSubscription =
				await this.prismaService.client.swSubscription.findFirst({
					where: {
						userId: me.id,
						endpoint: ps.endpoint,
					},
				});

			if (swSubscription === null) {
				throw new ApiError(meta.errors.noSuchRegistration);
			}

			if (ps.sendReadMessage !== undefined) {
				swSubscription.sendReadMessage = ps.sendReadMessage;
			}

			await this.prismaService.client.swSubscription.update({
				where: { id: swSubscription.id },
				data: { sendReadMessage: swSubscription.sendReadMessage },
			});

			return {
				userId: swSubscription.userId,
				endpoint: swSubscription.endpoint,
				sendReadMessage: swSubscription.sendReadMessage,
			};
		});
	}
}
