import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';

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
	constructor(private activeUsersChart: ActiveUsersChart) {
		super(meta, paramDef_, async (ps, me) => {
			return await this.activeUsersChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
			) satisfies z.infer<typeof res>;
		});
	}
}
