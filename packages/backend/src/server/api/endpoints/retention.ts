import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.unknown();
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
		super(meta, paramDef, async (ps, me) => {
			const records =
				await this.prismaService.client.retention_aggregation.findMany({
					orderBy: { id: 'desc' },
					take: 30,
				});

			return records.map((record) => ({
				createdAt: record.createdAt.toISOString(),
				users: record.usersCount,
				data: record.data,
			})) satisfies z.infer<typeof res>;
		});
	}
}
