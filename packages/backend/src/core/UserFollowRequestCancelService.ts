import { Injectable } from '@nestjs/common';
import type {
	PartialLocalUser,
	PartialRemoteUser,
} from '@/models/entities/User.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { user } from '@prisma/client';

@Injectable()
export class UserFollowRequestCancelService {
	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userEntityService: UserEntityService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async cancel(
		followee: Pick<user, 'id' | 'host' | 'uri' | 'inbox'>,
		follower: Pick<user, 'id' | 'host' | 'uri'>,
	): Promise<void> {
		if (this.userEntityUtilService.isRemoteUser(followee)) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderUndo(
					this.apRendererService.renderFollow(
						follower as PartialLocalUser | PartialRemoteUser,
						followee as PartialRemoteUser,
					),
					follower,
				),
			);

			if (this.userEntityUtilService.isLocalUser(follower)) {
				// 本来このチェックは不要だけどTSに怒られるので
				this.queueService.deliver(follower, content, followee.inbox, false);
			}
		}

		const requestExist =
			(await this.prismaService.client.followRequest.count({
				where: {
					followeeId: followee.id,
					followerId: follower.id,
				},
				take: 1,
			})) > 0;

		if (!requestExist) {
			throw new IdentifiableError(
				'17447091-ce07-46dd-b331-c1fd4f15b1e7',
				'request not found',
			);
		}

		await this.prismaService.client.followRequest.delete({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

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
