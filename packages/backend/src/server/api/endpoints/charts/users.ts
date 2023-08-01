import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import UsersChart from '@/core/chart/charts/users.js';

const res = z.object({
	local: z.object({
		total: z.array(z.number()),
		inc: z.array(z.number()),
		dec: z.array(z.number()),
	}),
	remote: z.object({
		total: z.array(z.number()),
		inc: z.array(z.number()),
		dec: z.array(z.number()),
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
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(private usersChart: UsersChart) {
		super(meta, paramDef_, async (ps, me) => {
			return await this.usersChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
			) satisfies z.infer<typeof res>;
		});
	}
}
