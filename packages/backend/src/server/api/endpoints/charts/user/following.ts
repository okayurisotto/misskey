import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.object({
	local: z.object({
		followings: z.object({
			total: z.array(z.number()),
			inc: z.array(z.number()),
			dec: z.array(z.number()),
		}),
		followers: z.object({
			total: z.array(z.number()),
			inc: z.array(z.number()),
			dec: z.array(z.number()),
		}),
	}),
	remote: z.object({
		followings: z.object({
			total: z.array(z.number()),
			inc: z.array(z.number()),
			dec: z.array(z.number()),
		}),
		followers: z.object({
			total: z.array(z.number()),
			inc: z.array(z.number()),
			dec: z.array(z.number()),
		}),
	}),
});
export const meta = {
	tags: ['charts', 'users', 'following'],
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
	constructor(private perUserFollowingChart: PerUserFollowingChart) {
		super(meta, paramDef_, async (ps, me) => {
			return await this.perUserFollowingChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
				ps.userId,
			) satisfies z.infer<typeof res>;
		});
	}
}
