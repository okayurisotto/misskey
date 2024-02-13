import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { FollowingSchema } from '@/models/zod/FollowingSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { Following, User } from '@prisma/client';

@Injectable()
export class FollowingEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	/**
	 * `following`をpackする。
	 *
	 * @param src
	 * @param me
	 * @param opts.populateFollowee `true`だった場合、返り値に`followee`が含まれるようになる。
	 * @param opts.populateFollower `true`だった場合、返り値に`follower`が含まれるようになる。
	 * @returns
	 */
	public async pack(
		src: Following['id'] | Following,
		me?: { id: User['id'] } | null | undefined,
		opts: {
			populateFollowee?: boolean;
			populateFollower?: boolean;
		} = {},
	): Promise<z.infer<typeof FollowingSchema>> {
		const following =
			typeof src === 'object'
				? src
				: await this.prismaService.client.following.findUniqueOrThrow({
						where: { id: src },
				  });

		const result = await awaitAll({
			followee: () =>
				opts.populateFollowee
					? this.userEntityService.packDetailed(following.followeeId, me)
					: Promise.resolve(undefined),
			follower: () =>
				opts.populateFollower
					? this.userEntityService.packDetailed(following.followerId, me)
					: Promise.resolve(undefined),
		});

		return {
			id: following.id,
			createdAt: following.createdAt.toISOString(),
			followeeId: following.followeeId,
			followerId: following.followerId,
			followee: result.followee,
			follower: result.follower,
		};
	}
}
