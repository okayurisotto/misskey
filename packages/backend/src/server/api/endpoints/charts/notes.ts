import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import NotesChart from '@/core/chart/charts/notes.js';
import { limit } from '@/models/zod/misc.js';

const res = z.object({
	local: z.object({
		total: z.array(z.number()),
		inc: z.array(z.number()),
		dec: z.array(z.number()),
		diffs: z.object({
			normal: z.array(z.number()),
			reply: z.array(z.number()),
			renote: z.array(z.number()),
			withFile: z.array(z.number()),
		}),
	}),
	remote: z.object({
		total: z.array(z.number()),
		inc: z.array(z.number()),
		dec: z.array(z.number()),
		diffs: z.object({
			normal: z.array(z.number()),
			reply: z.array(z.number()),
			renote: z.array(z.number()),
			withFile: z.array(z.number()),
		}),
	}),
});
export const meta = {
	tags: ['charts', 'notes'],
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
	constructor(private notesChart: NotesChart) {
		super(meta, paramDef, async (ps, me) => {
			return await this.notesChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
			) satisfies z.infer<typeof res>;
		});
	}
}
