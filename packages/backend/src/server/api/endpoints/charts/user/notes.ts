import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import PerUserNotesChart from '@/core/chart/charts/per-user-notes.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';

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
	constructor(private readonly perUserNotesChart: PerUserNotesChart) {
		super(meta, paramDef, async (ps) => {
			return await this.perUserNotesChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
				ps.userId,
			);
		});
	}
}
