import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import DriveChart from '@/core/chart/charts/drive.js';

const res = z.object({
	local: z.object({
		incCount: z.array(z.number()).optional(),
		incSize: z.array(z.number()).optional(),
		decCount: z.array(z.number()).optional(),
		decSize: z.array(z.number()).optional(),
	}),
	remote: z.object({
		incCount: z.array(z.number()).optional(),
		incSize: z.array(z.number()).optional(),
		decCount: z.array(z.number()).optional(),
		decSize: z.array(z.number()).optional(),
	}),
});
export const meta = {
	tags: ['charts', 'drive'],
	res,
	allowGet: true,
	cacheSec: 60 * 60,
} as const;

export const paramDef = z.object({
	span: z.enum(['day', 'hour']),
	limit: z.number().int().min(1).max(500).default(30),
	offset: z.number().int().nullable().default(null),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private driveChart: DriveChart) {
		super(meta, paramDef, async (ps, me) => {
			return await this.driveChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
			) satisfies z.infer<typeof res>;
		});
	}
}
