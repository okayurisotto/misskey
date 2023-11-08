import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { resetDb } from '@/misc/reset-db.js';

export const meta = {
	tags: ['non-productive'],
	requireCredential: false,
	description:
		'Only available when running with <code>NODE_ENV=testing</code>. Reset the database and flush Redis.',
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.redis)
		private readonly redisClient: Redis.Redis,
	) {
		super(meta, paramDef, async () => {
			if (process.env['NODE_ENV'] !== 'test') {
				throw new Error('NODE_ENV is not a test');
			}

			await this.redisClient.flushdb();
			await resetDb(this.db);

			await setTimeout(1000);
		});
	}
}
