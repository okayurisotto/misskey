import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IdService } from '@/core/IdService.js';
import type { User } from '@/models/entities/User.js';
import type { Blocking } from '@/models/entities/Blocking.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import Logger from '@/logger.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { WebhookService } from '@/core/WebhookService.js';
import { bindThis } from '@/decorators.js';
import { CacheService } from '@/core/CacheService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { blocking, user } from '@prisma/client';

@Injectable()
export class UserBlockingService implements OnModuleInit {
	private logger: Logger;
	private userFollowingService: UserFollowingService;

	constructor(
		private readonly moduleRef: ModuleRef,

		private readonly cacheService: CacheService,
		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly queueService: QueueService,
		private readonly globalEventService: GlobalEventService,
		private readonly webhookService: WebhookService,
		private readonly apRendererService: ApRendererService,
		private readonly loggerService: LoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.loggerService.getLogger('user-block');
	}

	onModuleInit() {
		this.userFollowingService = this.moduleRef.get('UserFollowingService');
	}

	@bindThis
	public async block(blocker: user, blockee: user, silent = false) {
		await Promise.all([
			this.cancelRequest(blocker, blockee, silent),
			this.cancelRequest(blockee, blocker, silent),
			this.userFollowingService.unfollow(blocker, blockee, silent),
			this.userFollowingService.unfollow(blockee, blocker, silent),
			this.removeFromList(blockee, blocker),
		]);

		const blocking: blocking = {
			id: this.idService.genId(),
			createdAt: new Date(),
			blockerId: blocker.id,
			blockeeId: blockee.id,
		};

		await this.prismaService.client.blocking.create({ data: blocking });

		this.cacheService.userBlockingCache.refresh(blocker.id);
		this.cacheService.userBlockedCache.refresh(blockee.id);

		this.globalEventService.publishInternalEvent('blockingCreated', {
			blockerId: blocker.id,
			blockeeId: blockee.id,
		});

		if (this.userEntityService.isLocalUser(blocker) && this.userEntityService.isRemoteUser(blockee)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderBlock({
				...blocking,
				blockee,
			}));
			this.queueService.deliver(blocker, content, blockee.inbox, false);
		}
	}

	@bindThis
	private async cancelRequest(follower: user, followee: user, silent = false) {
		const request = await this.prismaService.client.follow_request.findUnique({
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

		await this.prismaService.client.follow_request.delete({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		if (this.userEntityService.isLocalUser(followee)) {
			this.userEntityService.pack(followee, followee, {
				detail: true,
			}).then(packed => this.globalEventService.publishMainStream(followee.id, 'meUpdated', packed));
		}

		if (this.userEntityService.isLocalUser(follower) && !silent) {
			this.userEntityService.pack(followee, follower, {
				detail: true,
			}).then(async packed => {
				this.globalEventService.publishMainStream(follower.id, 'unfollow', packed);

				const webhooks = (await this.webhookService.getActiveWebhooks()).filter(x => x.userId === follower.id && x.on.includes('unfollow'));
				for (const webhook of webhooks) {
					this.queueService.webhookDeliver(webhook, 'unfollow', {
						user: packed,
					});
				}
			});
		}

		// リモートにフォローリクエストをしていたらUndoFollow送信
		if (this.userEntityService.isLocalUser(follower) && this.userEntityService.isRemoteUser(followee)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderUndo(this.apRendererService.renderFollow(follower, followee), follower));
			this.queueService.deliver(follower, content, followee.inbox, false);
		}

		// リモートからフォローリクエストを受けていたらReject送信
		if (this.userEntityService.isRemoteUser(follower) && this.userEntityService.isLocalUser(followee)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderReject(this.apRendererService.renderFollow(follower, followee, request.requestId!), followee));
			this.queueService.deliver(followee, content, follower.inbox, false);
		}
	}

	@bindThis
	private async removeFromList(listOwner: user, user: user) {
		await this.prismaService.client.user_list_joining.deleteMany({
			where: {
				user_list: { userId: listOwner.id },
				userId: user.id,
			}
		});
	}

	@bindThis
	public async unblock(blocker: user, blockee: user) {
		const blocking_ = await this.prismaService.client.blocking.findUnique({
			where: {
				blockerId_blockeeId: {
					blockerId: blocker.id,
					blockeeId: blockee.id,
				},
			},
		});

		if (blocking_ == null) {
			this.logger.warn('ブロック解除がリクエストされましたがブロックしていませんでした');
			return;
		}

		// Since we already have the blocker and blockee, we do not need to fetch
		// them in the query above and can just manually insert them here.
		const blocking = {
			...blocking_,
			blocker,
			blockee,
		};

		await this.prismaService.client.blocking.delete({ where: { id: blocking.id } });

		this.cacheService.userBlockingCache.refresh(blocker.id);
		this.cacheService.userBlockedCache.refresh(blockee.id);

		this.globalEventService.publishInternalEvent('blockingDeleted', {
			blockerId: blocker.id,
			blockeeId: blockee.id,
		});

		// deliver if remote bloking
		if (this.userEntityService.isLocalUser(blocker) && this.userEntityService.isRemoteUser(blockee)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderUndo(this.apRendererService.renderBlock(blocking), blocker));
			this.queueService.deliver(blocker, content, blockee.inbox, false);
		}
	}

	@bindThis
	public async checkBlocked(blockerId: User['id'], blockeeId: User['id']): Promise<boolean> {
		return (await this.cacheService.userBlockingCache.fetch(blockerId)).has(blockeeId);
	}
}
