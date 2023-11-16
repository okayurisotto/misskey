import * as os from 'node:os';
import { z } from 'zod';
import si from 'systeminformation';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';

const res = z.object({
	machine: z.string(),
	cpu: z.object({
		model: z.string(),
		cores: z.number().int().nonnegative(),
	}),
	mem: z.object({
		total: z.number().int().nonnegative(),
	}),
	fs: z.object({
		total: z.number().int().nonnegative(),
		used: z.number().int().nonnegative(),
	}),
});
export const meta = {
	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 1,
	tags: ['meta'],
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
	constructor(private readonly metaService: MetaService) {
		super(meta, paramDef, async () => {
			if (!(await this.metaService.fetch()).enableServerMachineStats) {
				return {
					machine: '?',
					cpu: {
						model: '?',
						cores: 0,
					},
					mem: {
						total: 0,
					},
					fs: {
						total: 0,
						used: 0,
					},
				};
			}

			const memStats = await si.mem();
			const fsStats = await si.fsSize();

			return {
				machine: os.hostname(),
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
			};
		});
	}
}
