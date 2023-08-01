import * as os from 'node:os';
import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import si from 'systeminformation';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';

const res = z.unknown();
export const meta = {
	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 1,
	tags: ['meta'],
	res: generateSchema(res),
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
	constructor(private metaService: MetaService) {
		super(meta, paramDef_, async () => {
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
				} satisfies z.infer<typeof res>;
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
			} satisfies z.infer<typeof res>;
		});
	}
}
