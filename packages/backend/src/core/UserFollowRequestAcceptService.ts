import { Injectable } from '@nestjs/common';
import type { PartialLocalUser } from '@/models/entities/User.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserFollowingCreateProcessService } from './UserFollowingCreateProcessService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { user } from '@prisma/client';

@Injectable()
export class UserFollowRequestAcceptService {
	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userEntityService: UserEntityService,
		private readonly userFollowingCreateProcessService: UserFollowingCreateProcessService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async accept(
		followee: {
			id: user['id'];
			host: user['host'];
			uri: user['host'];
			inbox: user['inbox'];
			sharedInbox: user['sharedInbox'];
		},
		follower: user,
	): Promise<void> {
		const request = await this.prismaService.client.followRequest.findUnique({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		if (request == null) {
			throw new IdentifiableError(
				'8884c2dd-5795-4ac9-b27e-6a01d38190f9',
				'No follow request.',
			);
		}

		await this.userFollowingCreateProcessService.process(followee, follower);

		if (
			this.userEntityUtilService.isRemoteUser(follower) &&
			this.userEntityUtilService.isLocalUser(followee)
		) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderAccept(
					this.apRendererService.renderFollow(
						follower,
						followee as PartialLocalUser,
						request.requestId!,
					),
					followee,
				),
			);
			this.queueService.deliver(followee, content, follower.inbox, false);
		}

		this.userEntityService
			.packDetailedMe(followee.id)
			.then((packed) =>
				this.globalEventService.publishMainStream(
					followee.id,
					'meUpdated',
					packed,
				),
			);
	}
}
