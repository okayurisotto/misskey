import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import ApRequestChart from '@/core/chart/charts/ap-request.js';
import { limit } from '@/models/zod/misc.js';

const res = z.object({
	deliverFailed: z.array(z.number()),
	deliverSucceeded: z.array(z.number()),
	inboxReceived: z.array(z.number()),
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
	constructor(private apRequestChart: ApRequestChart) {
		super(meta, paramDef, async (ps, me) => {
			return await this.apRequestChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
			) satisfies z.infer<typeof res>;
		});
	}
}
