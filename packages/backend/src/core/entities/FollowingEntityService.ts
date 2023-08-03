import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { FollowingsRepository } from '@/models/index.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type {} from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { Following } from '@/models/entities/Following.js';
import { bindThis } from '@/decorators.js';
import type { FollowingSchema } from '@/models/zod/FollowingSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';

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
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private userEntityService: UserEntityService,
	) {}

	@bindThis
	public isLocalFollower(
		following: Following,
	): following is LocalFollowerFollowing {
		return following.followerHost == null;
	}

	@bindThis
	public isRemoteFollower(
		following: Following,
	): following is RemoteFollowerFollowing {
		return following.followerHost != null;
	}

	@bindThis
	public isLocalFollowee(
		following: Following,
	): following is LocalFolloweeFollowing {
		return following.followeeHost == null;
	}

	@bindThis
	public isRemoteFollowee(
		following: Following,
	): following is RemoteFolloweeFollowing {
		return following.followeeHost != null;
	}

	@bindThis
	public async pack(
		src: Following['id'] | Following,
		me?: { id: User['id'] } | null | undefined,
		opts?: {
			populateFollowee?: boolean;
			populateFollower?: boolean;
		},
	): Promise<z.infer<typeof FollowingSchema>> {
		const following =
			typeof src === 'object'
				? src
				: await this.followingsRepository.findOneByOrFail({ id: src });

		if (opts == null) opts = {};

		const result = await awaitAll({
			followee: () =>
				opts?.populateFollowee
					? this.userEntityService.pack(
							following.followee ?? following.followeeId,
							me,
							{ detail: true },
					  )
					: Promise.resolve(undefined),
			follower: () =>
				opts?.populateFollower
					? this.userEntityService.pack(
							following.follower ?? following.followerId,
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
