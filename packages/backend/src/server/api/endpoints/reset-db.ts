import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { resetDb } from '@/misc/reset-db.js';

export const meta = {
	tags: ['non-productive'],
	requireCredential: false,
	description:
		'Only available when running with <code>NODE_ENV=testing</code>. Reset the database and flush Redis.',
	errors: {},
} as const;

const paramDef_ = z.object({});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,
	) {
		super(meta, paramDef_, async (ps, me) => {
			if (process.env.NODE_ENV !== 'test') {
				throw new Error('NODE_ENV is not a test');
			}

			await redisClient.flushdb();
			await resetDb(this.db);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		});
	}
}
