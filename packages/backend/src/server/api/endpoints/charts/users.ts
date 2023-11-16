import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import UsersChart from '@/core/chart/charts/users.js';
import { limit } from '@/models/zod/misc.js';

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
	constructor(private usersChart: UsersChart) {
		super(meta, paramDef, async (ps) => {
			return await this.usersChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
			);
		});
	}
}
