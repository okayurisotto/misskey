import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { FollowingEntityService } from '@/core/entities/FollowingEntityService.js';
import { FollowingSchema } from '@/models/zod/FollowingSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(FollowingSchema);
export const meta = {
	tags: ['federation'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z
	.object({
		host: z.string(),
		limit: limit({ max: 100, default: 10 }),
	})
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly followingEntityService: FollowingEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const followings = await this.prismaService.client.following.findMany({
				where: {
					AND: [paginationQuery.where, { follower: { host: ps.host } }],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				followings.map((following) =>
					this.followingEntityService.pack(following, me, {
						populateFollowee: true,
					}),
				),
			);
		});
	}
}
