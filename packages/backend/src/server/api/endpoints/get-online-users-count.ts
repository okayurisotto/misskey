import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { USER_ONLINE_THRESHOLD } from '@/const.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({
	count: z.number().int().nonnegative(),
});
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 1,
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
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async () => {
			const count = await this.prismaService.client.user.count({
				where: {
					lastActiveDate: { gt: new Date(Date.now() - USER_ONLINE_THRESHOLD) },
				},
			});

			return { count };
		});
	}
}
