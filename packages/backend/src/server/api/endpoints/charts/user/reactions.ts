import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import PerUserReactionsChart from '@/core/chart/charts/per-user-reactions.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';

const res = z.object({
	local: z.object({ count: z.array(z.number()) }),
	remote: z.object({ count: z.array(z.number()) }),
});
export const meta = {
	tags: ['charts', 'users', 'reactions'],
	res,
	allowGet: true,
	cacheSec: 60 * 60,
} as const;

export const paramDef = z.object({
	span: z.enum(['day', 'hour']),
	limit: limit({ max: 500, default: 30 }),
	offset: z.number().int().nullable().default(null),
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly perUserReactionsChart: PerUserReactionsChart) {
		super(meta, paramDef, async (ps) => {
			return await this.perUserReactionsChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
				ps.userId,
			);
		});
	}
}
