import * as os from 'node:os';
import { z } from 'zod';
import si from 'systeminformation';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

const res = z.object({
	machine: z.string(),
	os: z.string(),
	node: z.string(),
	psql: z.string(),
	cpu: z.object({
		model: z.string(),
		cores: z.number(),
	}),
	mem: z.object({
		total: z.number(),
	}),
	fs: z.object({
		total: z.number(),
		used: z.number(),
	}),
	net: z.object({
		interface: z.string(),
	}),
});
export const meta = {
	requireCredential: true,
	requireModerator: true,
	tags: ['admin', 'meta'],
	res,
} as const;

export const paramDef = z.unknown();

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,
	) {
		super(meta, paramDef, async () => {
			const memStats = await si.mem();
			const fsStats = await si.fsSize();
			const netInterface = await si.networkInterfaceDefault();

			const redisServerInfo = await this.redisClient.info('Server');
			const m = redisServerInfo.match(new RegExp('^redis_version:(.*)', 'm'));
			const redis_version = m?.[1];

			return {
				machine: os.hostname(),
				os: os.platform(),
				node: process.version,
				psql: await this.db
					.query('SHOW server_version')
					.then((x) => x[0].server_version),
				redis: redis_version,
				cpu: {
					model: os.cpus()[0].model,
					cores: os.cpus().length,
				},
				mem: {
					total: memStats.total,
				},
				fs: {
					total: fsStats[0].size,
					used: fsStats[0].used,
				},
				net: {
					interface: netInterface,
				},
			} satisfies z.infer<typeof res>;
		});
	}
}
