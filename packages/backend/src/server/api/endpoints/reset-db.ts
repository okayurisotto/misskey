import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { NODE_ENV } from '@/env.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { resetDb } from '@/misc/reset-db.js';
import { RedisService } from '@/core/RedisService.js';
import { TypeORMService } from '@/core/TypeORMService.js';

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
		private readonly db: TypeORMService,
		private readonly redisClient: RedisService,
	) {
		super(meta, paramDef, async () => {
			if (NODE_ENV !== 'test') {
				throw new Error('NODE_ENV is not a test');
			}

			await this.redisClient.flushdb();
			await resetDb(this.db);

			await setTimeout(1000);
		});
	}
}
