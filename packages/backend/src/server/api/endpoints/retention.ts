import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { RetentionAggregationsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

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
	constructor(
		@Inject(DI.retentionAggregationsRepository)
		private retentionAggregationsRepository: RetentionAggregationsRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const records = await this.retentionAggregationsRepository.find({
				order: {
					id: 'DESC',
				},
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
