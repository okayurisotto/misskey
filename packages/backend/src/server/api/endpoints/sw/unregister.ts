import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

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
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			await this.prismaService.client.swSubscription.deleteMany({
				where: {
					...(me ? { userId: me.id } : {}),
					endpoint: ps.endpoint,
				},
			});
		});
	}
}
