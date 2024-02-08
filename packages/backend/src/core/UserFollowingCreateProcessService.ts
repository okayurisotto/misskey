import { Injectable } from '@nestjs/common';
import { QueueService } from '@/core/QueueService.js';
import PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdService } from '@/core/IdService.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { WebhookService } from '@/core/WebhookService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MetaService } from '@/core/MetaService.js';
import { CacheService } from '@/core/CacheService.js';
import type { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import Logger from '../misc/logger.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import { UserEntityPackLiteService } from './entities/UserEntityPackLiteService.js';
import type { z } from 'zod';
import type { user } from '@prisma/client';

const logger = new Logger('following/create');

@Injectable()
export class UserFollowingCreateProcessService {
	constructor(
		private readonly cacheService: CacheService,
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly instanceChart: InstanceChart,
		private readonly metaService: MetaService,
		private readonly notificationService: NotificationService,
		private readonly perUserFollowingChart: PerUserFollowingChart,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userEntityService: UserEntityService,
		private readonly userEntityUtilService: UserEntityUtilService,
		private readonly webhookService: WebhookService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	public async process(
		followee: {
			id: user['id'];
			host: user['host'];
			uri: user['host'];
			inbox: user['inbox'];
			sharedInbox: user['sharedInbox'];
		},
		follower: {
			id: user['id'];
			host: user['host'];
			uri: user['host'];
			inbox: user['inbox'];
			sharedInbox: user['sharedInbox'];
		},
		silent = false,
	): Promise<void> {
		if (follower.id === followee.id) return;

		let alreadyFollowed = false as boolean;

		await this.prismaService.client.following
			.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					followerId: follower.id,
					followeeId: followee.id,

					// 非正規化
					followerHost: follower.host,
					followerInbox: this.userEntityUtilService.isRemoteUser(follower)
						? follower.inbox
						: null,
					followerSharedInbox: this.userEntityUtilService.isRemoteUser(follower)
						? follower.sharedInbox
						: null,
					followeeHost: followee.host,
					followeeInbox: this.userEntityUtilService.isRemoteUser(followee)
						? followee.inbox
						: null,
					followeeSharedInbox: this.userEntityUtilService.isRemoteUser(followee)
						? followee.sharedInbox
						: null,
				},
			})
			.catch((err) => {
				if (
					isDuplicateKeyValueError(err) &&
					this.userEntityUtilService.isRemoteUser(follower) &&
					this.userEntityUtilService.isLocalUser(followee)
				) {
					logger.info(
						`Insert duplicated ignore. ${follower.id} => ${followee.id}`,
					);
					alreadyFollowed = true;
				} else {
					throw err;
				}
			});

		this.cacheService.userFollowingsCache.refresh(follower.id);

		const requestExist =
			(await this.prismaService.client.followRequest.count({
				where: {
					followeeId: followee.id,
					followerId: follower.id,
				},
				take: 1,
			})) > 0;

		if (requestExist) {
			await this.prismaService.client.followRequest.delete({
				where: {
					followerId_followeeId: {
						followeeId: followee.id,
						followerId: follower.id,
					},
				},
			});

			// 通知を作成
			this.notificationService.createNotification(
				follower.id,
				'followRequestAccepted',
				{
					notifierId: followee.id,
				},
			);
		}

		if (alreadyFollowed) return;

		this.globalEventService.publishInternalEvent('follow', {
			followerId: follower.id,
			followeeId: followee.id,
		});

		const [followeeUser, followerUser] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: followee.id },
			}),
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: follower.id },
			}),
		]);

		// Neither followee nor follower has moved.
		if (!followeeUser.movedToUri && !followerUser.movedToUri) {
			//#region Increment counts
			await Promise.all([
				this.prismaService.client.user.update({
					where: { id: follower.id },
					data: { followingCount: { increment: 1 } },
				}),
				this.prismaService.client.user.update({
					where: { id: followee.id },
					data: { followersCount: { increment: 1 } },
				}),
			]);
			//#endregion

			//#region Update instance stats
			if (
				this.userEntityUtilService.isRemoteUser(follower) &&
				this.userEntityUtilService.isLocalUser(followee)
			) {
				this.federatedInstanceService.fetch(follower.host).then(async (i) => {
					this.prismaService.client.instance.update({
						where: { id: i.id },
						data: { followingCount: { increment: 1 } },
					});
					if (
						(await this.metaService.fetch()).enableChartsForFederatedInstances
					) {
						this.instanceChart.updateFollowing(i.host, true);
					}
				});
			} else if (
				this.userEntityUtilService.isLocalUser(follower) &&
				this.userEntityUtilService.isRemoteUser(followee)
			) {
				this.federatedInstanceService.fetch(followee.host).then(async (i) => {
					this.prismaService.client.instance.update({
						where: { id: i.id },
						data: { followersCount: { increment: 1 } },
					});
					if (
						(await this.metaService.fetch()).enableChartsForFederatedInstances
					) {
						this.instanceChart.updateFollowers(i.host, true);
					}
				});
			}
			//#endregion

			this.perUserFollowingChart.update(follower, followee, true);
		}

		// Publish follow event
		if (this.userEntityUtilService.isLocalUser(follower) && !silent) {
			this.userEntityService
				.packDetailed(followee.id, follower)
				.then(async (packed) => {
					this.globalEventService.publishMainStream(
						follower.id,
						'follow',
						packed as z.infer<typeof UserDetailedNotMeSchema>,
					);

					const webhooks = (
						await this.webhookService.getActiveWebhooks()
					).filter((x) => x.userId === follower.id && x.on.includes('follow'));
					for (const webhook of webhooks) {
						this.queueService.webhookDeliver(webhook, 'follow', {
							user: packed,
						});
					}
				});
		}

		// Publish followed event
		if (this.userEntityUtilService.isLocalUser(followee)) {
			const followerAsUser =
				await this.prismaService.client.user.findUniqueOrThrow({
					where: { id: follower.id },
				});
			this.userEntityPackLiteService
				.packLite(followerAsUser)
				.then(async (packed) => {
					this.globalEventService.publishMainStream(
						followee.id,
						'followed',
						packed,
					);

					const webhooks = (
						await this.webhookService.getActiveWebhooks()
					).filter(
						(x) => x.userId === followee.id && x.on.includes('followed'),
					);
					for (const webhook of webhooks) {
						this.queueService.webhookDeliver(webhook, 'followed', {
							user: packed,
						});
					}
				});

			// 通知を作成
			this.notificationService.createNotification(followee.id, 'follow', {
				notifierId: follower.id,
			});
		}
	}
}
