import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import PerUserReactionsChart from '@/core/chart/charts/per-user-reactions.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.object({
	local: z.object({ count: z.array(z.number()) }),
	remote: z.object({ count: z.array(z.number()) }),
});
export const meta = {
	tags: ['charts', 'users', 'reactions'],
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
	constructor(private perUserReactionsChart: PerUserReactionsChart) {
		super(meta, paramDef_, async (ps, me) => {
			return await this.perUserReactionsChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
				ps.userId,
			) satisfies z.infer<typeof res>;
		});
	}
}
