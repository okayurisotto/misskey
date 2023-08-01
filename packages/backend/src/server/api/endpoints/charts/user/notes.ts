import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import PerUserNotesChart from '@/core/chart/charts/per-user-notes.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.object({
	total: z.array(z.number()),
	inc: z.array(z.number()),
	dec: z.array(z.number()),
	diffs: z.object({
		normal: z.array(z.number()),
		reply: z.array(z.number()),
		renote: z.array(z.number()),
		withFile: z.array(z.number()),
	}),
});
export const meta = {
	tags: ['charts', 'users', 'notes'],
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
	constructor(private perUserNotesChart: PerUserNotesChart) {
		super(meta, paramDef_, async (ps, me) => {
			return await this.perUserNotesChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
				ps.userId,
			) satisfies z.infer<typeof res>;
		});
	}
}
