import { noSuchUser_________________, forbidden } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { FollowingEntityService } from '@/core/entities/FollowingEntityService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { FollowingSchema } from '@/models/zod/FollowingSchema.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(FollowingSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Show everyone that follows this user.',
	res,
	errors: {noSuchUser:noSuchUser_________________,forbidden:forbidden},
} as const;

const paramDef_base = z.object({
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	limit: limit({ max: 100, default: 10 }),
});
export const paramDef = z.union([
	paramDef_base.merge(z.object({ userId: MisskeyIdSchema })),
	paramDef_base.merge(
		z.object({
			username: z.string(),
			host: z
				.string()
				.nullable()
				.describe('The local host is represented with `null`.'),
		}),
	),
]);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly utilityService: UtilityService,
		private readonly followingEntityService: FollowingEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const user = await this.prismaService.client.user.findFirst({
				where:
					'userId' in ps
						? { id: ps.userId }
						: {
								usernameLower: ps.username.toLowerCase(),
								host: this.utilityService.toPunyNullable(ps.host) ?? null,
						  },
			});

			if (user == null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			const profile =
				await this.prismaService.client.user_profile.findUniqueOrThrow({
					where: { userId: user.id },
				});

			if (profile.ffVisibility === 'private') {
				if (me == null || me.id !== user.id) {
					throw new ApiError(meta.errors.forbidden);
				}
			} else if (profile.ffVisibility === 'followers') {
				if (me == null) {
					throw new ApiError(meta.errors.forbidden);
				} else if (me.id !== user.id) {
					const isFollowing =
						(await this.prismaService.client.following.count({
							where: {
								followeeId: user.id,
								followerId: me.id,
							},
							take: 1,
						})) > 0;
					if (!isFollowing) {
						throw new ApiError(meta.errors.forbidden);
					}
				}
			}

			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const followings = await this.prismaService.client.following.findMany({
				where: { AND: [paginationQuery.where, { followeeId: user.id }] },
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return (await Promise.all(
				followings.map((following) =>
					this.followingEntityService.pack(following, me, {
						populateFollowee: true,
					}),
				),
			)) satisfies z.infer<typeof res>;
		});
	}
}
