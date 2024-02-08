import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { FollowingEntityService } from '@/core/entities/FollowingEntityService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { FollowingSchema } from '@/models/zod/FollowingSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(FollowingSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Show everyone that this user is following.',
	res,
} as const;

const paramDef_base = z
	.object({ limit: limit({ max: 100, default: 10 }) })
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));
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
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
				take: ps.limit,
			});

			const followings = await this.prismaService.client.following.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{
							follower:
								'userId' in ps
									? { id: ps.userId }
									: {
											usernameLower: ps.username.toLowerCase(),
											host: this.utilityService.toPunyNullable(ps.host) ?? null,
									  },
						},
						{
							follower: {
								OR: [
									{
										AND: [
											// 無条件で取得できる
											{ user_profile: { ffVisibility: 'public' } },
										],
									},
									{
										AND: [
											// そのユーザーのフォロワーに自身が含まれる場合のみ取得できる
											{ user_profile: { ffVisibility: 'followers' } },
											{
												following_following_followeeIdTouser: {
													some: {
														followerId: { in: me === null ? [] : [me.id] },
													},
												},
											},
										],
									},
									{
										AND: [
											// そのユーザーが自分自身だった場合のみ取得できる
											{ user_profile: { ffVisibility: 'private' } },
											{ id: { in: me === null ? [] : [me.id] } },
										],
									},
								],
							},
						},
					],
				},
				orderBy: paginationQuery.orderBy,
				skip: paginationQuery.skip,
				take: paginationQuery.take,
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
