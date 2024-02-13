import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z
	.object({
		userId: z.string(),
		endpoint: z.string(),
		sendReadMessage: z.boolean(),
	})
	.nullable();
export const meta = {
	tags: ['account'],
	requireCredential: true,
	description: 'Check push notification registration exists.',
	res,
} as const;

export const paramDef = z.object({
	endpoint: z.string(),
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
			// if already subscribed
			const exist = await this.prismaService.client.swSubscription.findFirst({
				where: {
					userId: me.id,
					endpoint: ps.endpoint,
				},
			});

			if (exist != null) {
				return {
					userId: exist.userId,
					endpoint: exist.endpoint,
					sendReadMessage: exist.sendReadMessage,
				};
			}

			return null;
		});
	}
}
