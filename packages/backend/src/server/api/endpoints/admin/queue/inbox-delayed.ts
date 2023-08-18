import { URL } from 'node:url';
import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { InboxQueue } from '@/core/QueueModule.js';

const res = z.array(z.array(z.union([z.string(), z.number()])));
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
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
	constructor(@Inject('queue:inbox') public inboxQueue: InboxQueue) {
		super(meta, paramDef, async () => {
			const jobs = await this.inboxQueue.getJobs(['delayed']);

			const hosts = jobs
				.map((job) => new URL(job.data.signature.keyId).host)
				.reduce<Map<string, number>>((map, host) => {
					return map.set(host, (map.get(host) ?? 0) + 1);
				}, new Map());

			return [...hosts].sort((a, b) => b[1] - a[1]);
		});
	}
}
