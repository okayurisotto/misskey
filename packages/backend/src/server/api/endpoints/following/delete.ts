import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import {
	noSuchUser_____,
	followeeIsYourself_,
	notFollowing,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserFollowingDeleteService } from '@/core/UserFollowingDeleteService.js';
import { UserEntityPackLiteService } from '@/core/entities/UserEntityPackLiteService.js';
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
		noSuchUser: noSuchUser_____,
		followeeIsYourself: followeeIsYourself_,
		notFollowing: notFollowing,
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
		private readonly getterService: GetterService,
		private readonly prismaService: PrismaService,
		private readonly userFollowingDeleteService: UserFollowingDeleteService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
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

			await this.userFollowingDeleteService.delete(follower, followee);

			return await this.userEntityPackLiteService.packLite(followee);
		});
	}
}
