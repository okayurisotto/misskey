import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { RetentionAggregationsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown();
export const meta = {
	tags: ['users'],
	requireCredential: false,
	res: generateSchema(res),
	allowGet: true,
	cacheSec: 60 * 60,
} as const;

const paramDef_ = z.object({});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.retentionAggregationsRepository)
		private retentionAggregationsRepository: RetentionAggregationsRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
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
