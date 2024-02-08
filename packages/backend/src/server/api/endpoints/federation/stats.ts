import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { InstanceEntityService } from '@/core/entities/InstanceEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';

const res = z.object({
	topSubInstances: z.array(z.unknown()),
	otherFollowersCount: z.number().int().nonnegative(),
	topPubInstances: z.array(z.unknown()),
	otherFollowingCount: z.number().int().nonnegative(),
});
export const meta = {
	tags: ['federation'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 60,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly instanceEntityService: InstanceEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const [topSubInstances, topPubInstances, allSubCount, allPubCount] =
				await Promise.all([
					this.prismaService.client.instance.findMany({
						where: { followersCount: { gt: 0 } },
						orderBy: { followersCount: 'desc' },
						take: ps.limit,
					}),
					this.prismaService.client.instance.findMany({
						where: { followingCount: { gt: 0 } },
						orderBy: { followingCount: 'desc' },
						take: ps.limit,
					}),
					this.prismaService.client.following.count({
						where: { followee: { host: { not: null } } },
					}),
					this.prismaService.client.following.count({
						where: { follower: { host: { not: null } } },
					}),
				]);

			const gotSubCount = topSubInstances
				.map((x) => x.followersCount)
				.reduce((a, b) => a + b, 0);
			const gotPubCount = topPubInstances
				.map((x) => x.followingCount)
				.reduce((a, b) => a + b, 0);

			const result = await awaitAll({
				topSubInstances: () =>
					Promise.all(
						topSubInstances.map((instacne) =>
							this.instanceEntityService.pack(instacne),
						),
					),
				topPubInstances: () =>
					Promise.all(
						topPubInstances.map((instacne) =>
							this.instanceEntityService.pack(instacne),
						),
					),
			});

			return {
				topSubInstances: result.topSubInstances,
				otherFollowersCount: Math.max(0, allSubCount - gotSubCount),
				topPubInstances: result.topPubInstances,
				otherFollowingCount: Math.max(0, allPubCount - gotPubCount),
			};
		});
	}
}
