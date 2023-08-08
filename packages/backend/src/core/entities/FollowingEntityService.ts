import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type {} from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { Following } from '@/models/entities/Following.js';
import { bindThis } from '@/decorators.js';
import type { FollowingSchema } from '@/models/zod/FollowingSchema.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { following } from '@prisma/client';

type LocalFollowerFollowing = Following & {
	followerHost: null;
	followerInbox: null;
	followerSharedInbox: null;
};

type RemoteFollowerFollowing = Following & {
	followerHost: string;
	followerInbox: string;
	followerSharedInbox: string;
};

type LocalFolloweeFollowing = Following & {
	followeeHost: null;
	followeeInbox: null;
	followeeSharedInbox: null;
};

type RemoteFolloweeFollowing = Following & {
	followeeHost: string;
	followeeInbox: string;
	followeeSharedInbox: string;
};

@Injectable()
export class FollowingEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	@bindThis
	public isLocalFollower(
		following: T2P<Following, following>,
	): following is LocalFollowerFollowing {
		return following.followerHost == null;
	}

	@bindThis
	public isRemoteFollower(
		following: T2P<Following, following>,
	): following is RemoteFollowerFollowing {
		return following.followerHost != null;
	}

	@bindThis
	public isLocalFollowee(
		following: T2P<Following, following>,
	): following is LocalFolloweeFollowing {
		return following.followeeHost == null;
	}

	@bindThis
	public isRemoteFollowee(
		following: T2P<Following, following>,
	): following is RemoteFolloweeFollowing {
		return following.followeeHost != null;
	}

	@bindThis
	public async pack(
		src: Following['id'] | T2P<Following, following>,
		me?: { id: User['id'] } | null | undefined,
		opts?: {
			populateFollowee?: boolean;
			populateFollower?: boolean;
		},
	): Promise<z.infer<typeof FollowingSchema>> {
		const following =
			typeof src === 'object'
				? src
				: await this.prismaService.client.following.findUniqueOrThrow({ where: { id: src } });

		if (opts == null) opts = {};

		const result = await awaitAll({
			followee: () =>
				opts?.populateFollowee
					? this.userEntityService.pack(
							following.followeeId,
							me,
							{ detail: true },
					  )
					: Promise.resolve(undefined),
			follower: () =>
				opts?.populateFollower
					? this.userEntityService.pack(
							following.followerId,
							me,
							{ detail: true },
					  )
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
