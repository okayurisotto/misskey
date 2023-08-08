import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
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
		followeeIsYourself: {
			message: 'Followee is yourself.',
			code: 'FOLLOWEE_IS_YOURSELF',
			id: 'd9e400b9-36b0-4808-b1d8-79e707f1296c',
		},
		notFollowing: {
			message: 'You are not following that user.',
			code: 'NOT_FOLLOWING',
			id: '5dbf82f5-c92b-40b1-87d1-6c8c0741fd09',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly getterService: GetterService,
		private readonly userFollowingService: UserFollowingService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const follower = me;

			// Check if the followee is yourself
			if (me.id === ps.userId) {
				throw new ApiError(meta.errors.followeeIsYourself);
			}

			// Get followee
			const followee = await this.getterService
				.getUser(ps.userId)
				.catch((err) => {
					if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
						throw new ApiError(meta.errors.noSuchUser);
					}
					throw err;
				});

			// Check not following
			const exist =
				(await this.prismaService.client.following.count({
					where: {
						followerId: follower.id,
						followeeId: followee.id,
					},
					take: 1,
				})) > 0;

			if (!exist) {
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
