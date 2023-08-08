import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { PrismaService } from '@/core/PrismaService.js';
import { resetDb } from '@/misc/reset-db.js';

export const meta = {
	tags: ['non-productive'],
	requireCredential: false,
	description:
		'Only available when running with <code>NODE_ENV=testing</code>. Reset the database and flush Redis.',
	errors: {},
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
		@Inject(DI.redis)
		private readonly redisClient: Redis.Redis,

		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (process.env.NODE_ENV !== 'test') {
				throw new Error('NODE_ENV is not a test');
			}

			await this.redisClient.flushdb();
			await resetDb(this.prismaService.client);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		});
	}
}
