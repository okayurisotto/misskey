import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(FollowingSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Show everyone that follows this user.',
	res: generateSchema(res),
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '27fa5435-88ab-43de-9360-387de88727cd',
		},
		forbidden: {
			message: 'Forbidden.',
			code: 'FORBIDDEN',
			id: '3c6a84db-d619-26af-ca14-06232a21df8a',
		},
	},
} as const;

const paramDefBase = z.object({
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
	limit: z.number().int().min(1).max(100).default(10),
});
const paramDef_ = z.union([
	paramDefBase.merge(z.object({ userId: misskeyIdPattern })),
	paramDefBase.merge(
		z.object({
			username: z.string(),
			host: z
				.string()
				.nullable()
				.describe('The local host is represented with `null`.'),
		}),
	),
]);
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
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
		super(meta, paramDef_, async (ps, me) => {
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
				.andWhere('following.followeeId = :userId', { userId: user.id })
				.innerJoinAndSelect('following.follower', 'follower');

			const followings = await query.limit(ps.limit).getMany();

			return (await this.followingEntityService.packMany(followings, me, {
				populateFollower: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
