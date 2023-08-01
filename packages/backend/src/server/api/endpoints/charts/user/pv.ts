import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import PerUserPvChart from '@/core/chart/charts/per-user-pv.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.object({
	pv: z.object({
		user: z.array(z.number()),
		visitor: z.array(z.number()),
	}),
	upv: z.object({
		user: z.array(z.number()),
		visitor: z.array(z.number()),
	}),
});
export const meta = {
	tags: ['charts', 'users'],
	res: generateSchema(res),
	allowGet: true,
	cacheSec: 60 * 60,
} as const;

const paramDef_ = z.object({
	span: z.enum(['day', 'hour']),
	limit: z.number().int().min(1).max(500).default(30),
	offset: z.number().int().nullable().default(null),
	userId: misskeyIdPattern,
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(private perUserPvChart: PerUserPvChart) {
		super(meta, paramDef_, async (ps, me) => {
			return await this.perUserPvChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
				ps.userId,
			) satisfies z.infer<typeof res>;
		});
	}
}
