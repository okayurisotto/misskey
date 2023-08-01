import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import FederationChart from '@/core/chart/charts/federation.js';

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
	res: generateSchema(res),
	allowGet: true,
	cacheSec: 60 * 60,
} as const;

const paramDef_ = z.object({
	span: z.enum(['day', 'hour']),
	limit: z.number().int().min(1).max(500).default(30),
	offset: z.number().int().nullable().default(null),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(private federationChart: FederationChart) {
		super(meta, paramDef_, async (ps, me) => {
			return await this.federationChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
			) satisfies z.infer<typeof res>;
		});
	}
}
