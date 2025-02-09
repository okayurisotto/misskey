import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { limit } from '@/models/zod/misc.js';

const res = z.object({
	readWrite: z.array(z.number()).optional(),
	read: z.array(z.number()).optional(),
	write: z.array(z.number()).optional(),
	registeredWithinWeek: z.array(z.number()).optional(),
	registeredWithinMonth: z.array(z.number()).optional(),
	registeredWithinYear: z.array(z.number()).optional(),
	registeredOutsideWeek: z.array(z.number()).optional(),
	registeredOutsideMonth: z.array(z.number()).optional(),
	registeredOutsideYear: z.array(z.number()).optional(),
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
	constructor(private readonly activeUsersChart: ActiveUsersChart) {
		super(meta, paramDef, async (ps) => {
			return await this.activeUsersChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
			);
		});
	}
}
