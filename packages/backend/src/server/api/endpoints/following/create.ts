import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import {
	noSuchUser____,
	followeeIsYourself,
	alreadyFollowing,
	blocking,
	blocked,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
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
		max: 50,
	},
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:following',
	errors: {
		noSuchUser: noSuchUser____,
		followeeIsYourself: followeeIsYourself,
		alreadyFollowing: alreadyFollowing,
		blocking: blocking,
		blocked: blocked,
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

			// 自分自身
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

			// Check if already following
			const exist =
				(await this.prismaService.client.following.count({
					where: {
						followerId: follower.id,
						followeeId: followee.id,
					},
					take: 1,
				})) > 0;

			if (exist) {
				throw new ApiError(meta.errors.alreadyFollowing);
			}

			try {
				await this.userFollowingService.follow(follower, followee);
			} catch (e) {
				if (e instanceof IdentifiableError) {
					if (e.id === '710e8fb0-b8c3-4922-be49-d5d93d8e6a6e') {
						throw new ApiError(meta.errors.blocking);
					}
					if (e.id === '3338392a-f764-498d-8855-db939dcf8c48') {
						throw new ApiError(meta.errors.blocked);
					}
				}
				throw e;
			}

			return await this.userEntityService.packLite(followee);
		});
	}
}
