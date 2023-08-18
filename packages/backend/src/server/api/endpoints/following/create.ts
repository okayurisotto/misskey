import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
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
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'fcd2eef9-a9b2-4c4f-8624-038099e90aa5',
		},
		followeeIsYourself: {
			message: 'Followee is yourself.',
			code: 'FOLLOWEE_IS_YOURSELF',
			id: '26fbe7bb-a331-4857-af17-205b426669a9',
		},
		alreadyFollowing: {
			message: 'You are already following that user.',
			code: 'ALREADY_FOLLOWING',
			id: '35387507-38c7-4cb9-9197-300b93783fa0',
		},
		blocking: {
			message: 'You are blocking that user.',
			code: 'BLOCKING',
			id: '4e2206ec-aa4f-4960-b865-6c23ac38e2d9',
		},
		blocked: {
			message: 'You are blocked by that user.',
			code: 'BLOCKED',
			id: 'c4ab57cc-4e41-45e9-bfd9-584f61e35ce0',
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

			return (await this.userEntityService.packLite(followee.id)) satisfies z.infer<typeof res>;
		});
	}
}
