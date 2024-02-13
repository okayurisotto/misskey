import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { WebhookService } from '@/core/WebhookService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { UserFollowingDeleteService } from './UserFollowingDeleteService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { Blocking, User } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class UserBlockingCreateService {
	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userEntityService: UserEntityService,
		private readonly userFollowingDeleteService: UserFollowingDeleteService,
		private readonly webhookService: WebhookService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async create(
		blocker: User,
		blockee: User,
		silent = false,
	): Promise<void> {
		await Promise.all([
			this.cancelRequest(blocker, blockee, silent),
			this.cancelRequest(blockee, blocker, silent),
			this.userFollowingDeleteService.delete(blocker, blockee, silent),
			this.userFollowingDeleteService.delete(blockee, blocker, silent),
			this.removeFromList(blockee, blocker),
		]);

		const blocking: Blocking = {
			id: this.idService.genId(),
			createdAt: new Date(),
			blockerId: blocker.id,
			blockeeId: blockee.id,
		};

		await this.prismaService.client.blocking.create({ data: blocking });

		if (
			this.userEntityUtilService.isLocalUser(blocker) &&
			this.userEntityUtilService.isRemoteUser(blockee)
		) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderBlock({
					...blocking,
					blockee,
				}),
			);
			this.queueService.deliver(blocker, content, blockee.inbox, false);
		}
	}

	private async cancelRequest(
		follower: User,
		followee: User,
		silent = false,
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
			return;
		}

		await this.prismaService.client.followRequest.delete({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		if (this.userEntityUtilService.isLocalUser(followee)) {
			this.userEntityService
				.packDetailedMe(followee)
				.then((packed) =>
					this.globalEventService.publishMainStream(
						followee.id,
						'meUpdated',
						packed,
					),
				);
		}

		if (this.userEntityUtilService.isLocalUser(follower) && !silent) {
			this.userEntityService
				.packDetailed(followee, follower)
				.then(async (packed) => {
					this.globalEventService.publishMainStream(
						follower.id,
						'unfollow',
						packed as z.infer<typeof UserDetailedNotMeSchema>,
					);

					const webhooks = (
						await this.webhookService.getActiveWebhooks()
					).filter(
						(x) => x.userId === follower.id && x.on.includes('unfollow'),
					);
					for (const webhook of webhooks) {
						this.queueService.webhookDeliver(webhook, 'unfollow', {
							user: packed,
						});
					}
				});
		}

		// リモートにフォローリクエストをしていたらUndoFollow送信
		if (
			this.userEntityUtilService.isLocalUser(follower) &&
			this.userEntityUtilService.isRemoteUser(followee)
		) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderUndo(
					this.apRendererService.renderFollow(follower, followee),
					follower,
				),
			);
			this.queueService.deliver(follower, content, followee.inbox, false);
		}

		// リモートからフォローリクエストを受けていたらReject送信
		if (
			this.userEntityUtilService.isRemoteUser(follower) &&
			this.userEntityUtilService.isLocalUser(followee)
		) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderReject(
					this.apRendererService.renderFollow(
						follower,
						followee,
						request.requestId!,
					),
					followee,
				),
			);
			this.queueService.deliver(followee, content, follower.inbox, false);
		}
	}

	private async removeFromList(listOwner: User, user: User): Promise<void> {
		await this.prismaService.client.user_list_joining.deleteMany({
			where: {
				user_list: { userId: listOwner.id },
				userId: user.id,
			},
		});
	}
}
