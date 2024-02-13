import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(
	z.object({
		createdAt: z.string().datetime(),
		users: z.number().int().nonnegative(),
	}),
);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	res,
	allowGet: true,
	cacheSec: 60 * 60,
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
			const records =
				await this.prismaService.client.retentionAggregation.findMany({
					orderBy: { id: 'desc' },
					take: 30,
				});

			return records.map((record) => ({
				createdAt: record.createdAt.toISOString(),
				users: record.usersCount,
				data: record.data,
			}));
		});
	}
}
