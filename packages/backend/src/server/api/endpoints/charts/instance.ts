import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import { limit } from '@/models/zod/misc.js';

const res = z.object({
	requests: z.object({
		failed: z.array(z.number()),
		succeeded: z.array(z.number()),
		received: z.array(z.number()),
	}),
	notes: z.object({
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
	users: z.object({
		total: z.array(z.number()),
		inc: z.array(z.number()),
		dec: z.array(z.number()),
	}),
	following: z.object({
		total: z.array(z.number()),
		inc: z.array(z.number()),
		dec: z.array(z.number()),
	}),
	followers: z.object({
		total: z.array(z.number()),
		inc: z.array(z.number()),
		dec: z.array(z.number()),
	}),
	drive: z.object({
		totalFiles: z.array(z.number()),
		incFiles: z.array(z.number()),
		decFiles: z.array(z.number()),
		incUsage: z.array(z.number()),
		decUsage: z.array(z.number()),
	}),
});
export const meta = {
	tags: ['charts'],
	res,
	allowGet: true,
	cacheSec: 60 * 60,
} as const;

export const paramDef = z.object({
	span: z.enum(['day', 'hour']),
	limit: limit({ max: 500, default: 30 }),
	offset: z.number().int().nullable().default(null),
	host: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly instanceChart: InstanceChart) {
		super(meta, paramDef, async (ps) => {
			return await this.instanceChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
				ps.host,
			);
		});
	}
}
