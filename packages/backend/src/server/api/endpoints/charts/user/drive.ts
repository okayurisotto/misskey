import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import PerUserDriveChart from '@/core/chart/charts/per-user-drive.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.object({
	totalCount: z.array(z.number()),
	totalSize: z.array(z.number()),
	incCount: z.array(z.number()),
	incSize: z.array(z.number()),
	decCount: z.array(z.number()),
	decSize: z.array(z.number()),
});
export const meta = {
	tags: ['charts', 'drive', 'users'],
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
	constructor(private perUserDriveChart: PerUserDriveChart) {
		super(meta, paramDef_, async (ps, me) => {
			return await this.perUserDriveChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
				ps.userId,
			) satisfies z.infer<typeof res>;
		});
	}
}
