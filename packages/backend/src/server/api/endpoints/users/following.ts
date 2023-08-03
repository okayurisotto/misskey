import { z } from 'zod';
import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type {
	UsersRepository,
	FollowingsRepository,
	UserProfilesRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { FollowingEntityService } from '@/core/entities/FollowingEntityService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { DI } from '@/di-symbols.js';
import { FollowingSchema } from '@/models/zod/FollowingSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(FollowingSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Show everyone that this user is following.',
	res,
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '63e4aba4-4156-4e53-be25-c9559e42d71b',
		},
		forbidden: {
			message: 'Forbidden.',
			code: 'FORBIDDEN',
			id: 'f6cdb0df-c19f-ec5c-7dbb-0ba84a1f92ba',
		},
	},
} as const;

const paramDef_base = z.object({
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	limit: z.number().int().min(1).max(100).default(10),
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
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private utilityService: UtilityService,
		private followingEntityService: FollowingEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const user = await this.usersRepository.findOneBy(
				'userId' in ps
					? { id: ps.userId }
					: {
							usernameLower: ps.username!.toLowerCase(),
							host: this.utilityService.toPunyNullable(ps.host) ?? IsNull(),
					  },
			);

			if (user == null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			const profile = await this.userProfilesRepository.findOneByOrFail({
				userId: user.id,
			});

			if (profile.ffVisibility === 'private') {
				if (me == null || me.id !== user.id) {
					throw new ApiError(meta.errors.forbidden);
				}
			} else if (profile.ffVisibility === 'followers') {
				if (me == null) {
					throw new ApiError(meta.errors.forbidden);
				} else if (me.id !== user.id) {
					const isFollowing = await this.followingsRepository.exist({
						where: {
							followeeId: user.id,
							followerId: me.id,
						},
					});
					if (!isFollowing) {
						throw new ApiError(meta.errors.forbidden);
					}
				}
			}

			const query = this.queryService
				.makePaginationQuery(
					this.followingsRepository.createQueryBuilder('following'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('following.followerId = :userId', { userId: user.id })
				.innerJoinAndSelect('following.followee', 'followee');

			const followings = await query.limit(ps.limit).getMany();

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
