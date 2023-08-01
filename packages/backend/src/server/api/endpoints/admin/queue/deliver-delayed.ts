import { URL } from 'node:url';
import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DeliverQueue } from '@/core/QueueModule.js';

const res = z.array(z.array(z.union([z.string(), z.number()])));
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
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
	constructor(@Inject('queue:deliver') public deliverQueue: DeliverQueue) {
		super(meta, paramDef, async (ps, me) => {
			const jobs = await this.deliverQueue.getJobs(['delayed']);

			const res_ = [] as [string, number][];

			for (const job of jobs) {
				const host = new URL(job.data.to).host;
				if (res_.find((x) => x[0] === host)) {
					res_.find((x) => x[0] === host)![1]++;
				} else {
					res_.push([host, 1]);
				}
			}

			res_.sort((a, b) => b[1] - a[1]);

			return res_ satisfies z.infer<typeof res>;
		});
	}
}
