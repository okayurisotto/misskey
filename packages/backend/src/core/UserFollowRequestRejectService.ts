import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { QueueService } from '@/core/QueueService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserFollowRequestDeleteService } from './UserFollowRequestDeleteService.js';
import { UserFollowingDeletionPublishService } from './UserFollowingDeletionPublishService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';

type Local =
	| LocalUser
	| {
			id: LocalUser['id'];
			host: LocalUser['host'];
			uri: LocalUser['uri'];
	  };
type Remote =
	| RemoteUser
	| {
			id: RemoteUser['id'];
			host: RemoteUser['host'];
			uri: RemoteUser['uri'];
			inbox: RemoteUser['inbox'];
	  };
type Both = Local | Remote;

@Injectable()
export class UserFollowRequestRejectService {
	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userFollowingDeletionPublishService: UserFollowingDeletionPublishService,
		private readonly userFollowRequestDeleteService: UserFollowRequestDeleteService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * API following/request/reject
	 */
	public async reject(user: Local, follower: Both): Promise<void> {
		if (this.userEntityUtilService.isRemoteUser(follower)) {
			await this.deliverReject(user, follower);
		}

		await this.userFollowRequestDeleteService.delete(user, follower);

		if (this.userEntityUtilService.isLocalUser(follower)) {
			await this.userFollowingDeletionPublishService.publish(user, follower);
		}
	}

	/**
	 * Deliver Reject to remote
	 */
	private async deliverReject(
		followee: Local,
		follower: Remote,
	): Promise<void> {
		const request = await this.prismaService.client.followRequest.findUnique({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		const content = this.apRendererService.addContext(
			this.apRendererService.renderReject(
				this.apRendererService.renderFollow(
					follower,
					followee,
					request?.requestId ?? undefined,
				),
				followee,
			),
		);
		this.queueService.deliver(followee, content, follower.inbox, false);
	}
}
