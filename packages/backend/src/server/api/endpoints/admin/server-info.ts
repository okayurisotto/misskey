import * as os from 'node:os';
import { z } from 'zod';
import si from 'systeminformation';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { PrismaService } from '@/core/PrismaService.js';

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

	redis: z.string().optional(),
});
export const meta = {
	requireCredential: true,
	requireModerator: true,
	tags: ['admin', 'meta'],
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
	constructor(
		@Inject(DI.redis)
		private readonly redisClient: Redis.Redis,

		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async () => {
			const [memStats, fsStats, netInterface, redisServerInfo, psqlServerInfo] =
				await Promise.all([
					si.mem(),
					si.fsSize(),
					si.networkInterfaceDefault(),
					this.redisClient.info('Server'),
					this.prismaService.client.$queryRaw`SHOW server_version`,
				]);

			const m = redisServerInfo.match(/^redis_version:(.*)/m);
			const redisVersion = m?.at(1);

			const psqlVersion = z
				.tuple([z.object({ server_version: z.string() })])
				.parse(psqlServerInfo)[0]['server_version'];

			return {
				machine: os.hostname(),
				os: os.platform(),
				node: process.version,
				psql: psqlVersion,
				redis: redisVersion,
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
			};
		});
	}
}
