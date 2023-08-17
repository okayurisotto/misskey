import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import FederationChart from '@/core/chart/charts/federation.js';
import { limit } from '@/models/zod/misc.js';

const res = z.object({
	deliveredInstances: z.array(z.number()),
	inboxInstances: z.array(z.number()),
	stalled: z.array(z.number()),
	sub: z.array(z.number()),
	pub: z.array(z.number()),
	pubsub: z.array(z.number()),
	subActive: z.array(z.number()),
	pubActive: z.array(z.number()),
});
export const meta = {
	tags: ['charts'],
	res,
	allowGet: true,
	cacheSec: 60 * 60,
} as const;

export const paramDef = z.object({
	span: z.enum(['day', 'hour']),
	limit: limit({ max: 500, default: 30 }),
	offset: z.number().int().nullable().default(null),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private federationChart: FederationChart) {
		super(meta, paramDef, async (ps, me) => {
			return await this.federationChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
			) satisfies z.infer<typeof res>;
		});
	}
}
