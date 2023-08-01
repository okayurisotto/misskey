import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { UsersRepository, FollowingsRepository } from '@/models/index.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = UserLiteSchema;
export const meta = {
	tags: ['following', 'users'],
	limit: {
		duration: ms('1hour'),
		max: 100,
	},
	requireCredential: true,
	kind: 'write:following',
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '5b12c78d-2b28-4dca-99d2-f56139b42ff8',
		},
		followerIsYourself: {
			message: 'Follower is yourself.',
			code: 'FOLLOWER_IS_YOURSELF',
			id: '07dc03b9-03da-422d-885b-438313707662',
		},
		notFollowing: {
			message: 'The other use is not following you.',
			code: 'NOT_FOLLOWING',
			id: '5dbf82f5-c92b-40b1-87d1-6c8c0741fd09',
		},
	},
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
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
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private userEntityService: UserEntityService,
		private getterService: GetterService,
		private userFollowingService: UserFollowingService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const followee = me;

			// Check if the follower is yourself
			if (me.id === ps.userId) {
				throw new ApiError(meta.errors.followerIsYourself);
			}

			// Get follower
			const follower = await this.getterService
				.getUser(ps.userId)
				.catch((err) => {
					if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
						throw new ApiError(meta.errors.noSuchUser);
					}
					throw err;
				});

			// Check not following
			const exist = await this.followingsRepository.findOneBy({
				followerId: follower.id,
				followeeId: followee.id,
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notFollowing);
			}

			await this.userFollowingService.unfollow(follower, followee);

			return (await this.userEntityService.pack(
				followee.id,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
