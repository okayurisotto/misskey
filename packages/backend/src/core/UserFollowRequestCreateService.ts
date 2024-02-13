import { Injectable } from '@nestjs/common';
import type {
	PartialLocalUser,
	PartialRemoteUser,
} from '@/models/entities/User.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdService } from '@/core/IdService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { UserBlockingCheckService } from './UserBlockingCheckService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { User } from '@prisma/client';
import { UserEntityPackLiteService } from './entities/UserEntityPackLiteService.js';

@Injectable()
export class UserFollowRequestCreateService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly queueService: QueueService,
		private readonly globalEventService: GlobalEventService,
		private readonly notificationService: NotificationService,
		private readonly apRendererService: ApRendererService,
		private readonly prismaService: PrismaService,
		private readonly userBlockingCheckService: UserBlockingCheckService,
		private readonly userEntityUtilService: UserEntityUtilService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	public async create(
		follower: Pick<User, 'id' | 'host' | 'uri' | 'inbox' | 'sharedInbox'>,
		followee: Pick<User, 'id' | 'host' | 'uri' | 'inbox' | 'sharedInbox'>,
		requestId?: string,
	): Promise<void> {
		if (follower.id === followee.id) return;

		// check blocking
		const [blocking, blocked] = await Promise.all([
			this.userBlockingCheckService.check(follower.id, followee.id),
			this.userBlockingCheckService.check(followee.id, follower.id),
		]);

		if (blocking) throw new Error('blocking');
		if (blocked) throw new Error('blocked');

		const followRequest = await this.prismaService.client.followRequest.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				followerId: follower.id,
				followeeId: followee.id,
				requestId,
			},
		});

		// Publish receiveRequest event
		if (this.userEntityUtilService.isLocalUser(followee)) {
			const followerAsUser =
				await this.prismaService.client.user.findUniqueOrThrow({
					where: { id: follower.id },
				});
			this.userEntityPackLiteService
				.packLite(followerAsUser)
				.then((packed) =>
					this.globalEventService.publishMainStream(
						followee.id,
						'receiveFollowRequest',
						packed,
					),
				);

			this.userEntityService
				.packDetailedMe(followee.id)
				.then((packed) =>
					this.globalEventService.publishMainStream(
						followee.id,
						'meUpdated',
						packed,
					),
				);

			// 通知を作成
			this.notificationService.createNotification(
				followee.id,
				'receiveFollowRequest',
				{
					notifierId: follower.id,
					followRequestId: followRequest.id,
				},
			);
		}

		if (
			this.userEntityUtilService.isLocalUser(follower) &&
			this.userEntityUtilService.isRemoteUser(followee)
		) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderFollow(
					follower as PartialLocalUser,
					followee as PartialRemoteUser,
					requestId ??
						`${this.configLoaderService.data.url}/follows/${followRequest.id}`,
				),
			);
			this.queueService.deliver(follower, content, followee.inbox, false);
		}
	}
}
