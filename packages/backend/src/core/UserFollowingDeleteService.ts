import { Injectable } from '@nestjs/common';
import type {
	PartialLocalUser,
	PartialRemoteUser,
} from '@/models/entities/User.js';
import { QueueService } from '@/core/QueueService.js';
import PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { WebhookService } from '@/core/WebhookService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { MetaService } from '@/core/MetaService.js';
import type { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import Logger from '../misc/logger.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { z } from 'zod';
import type { user } from '@prisma/client';

const logger = new Logger('following/create');

@Injectable()
export class UserFollowingDeleteService {
	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly globalEventService: GlobalEventService,
		private readonly instanceChart: InstanceChart,
		private readonly metaService: MetaService,
		private readonly perUserFollowingChart: PerUserFollowingChart,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userEntityService: UserEntityService,
		private readonly webhookService: WebhookService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async delete(
		follower: Pick<user, 'id' | 'host' | 'uri' | 'inbox' | 'sharedInbox'>,
		followee: Pick<user, 'id' | 'host' | 'uri' | 'inbox' | 'sharedInbox'>,
		silent = false,
	): Promise<void> {
		const following = await this.prismaService.client.following.findUnique({
			where: {
				followerId_followeeId: {
					followerId: follower.id,
					followeeId: followee.id,
				},
			},
			include: {
				follower: true,
				followee: true,
			},
		});

		if (following === null) {
			logger.warn(
				'フォロー解除がリクエストされましたがフォローしていませんでした',
			);
			return;
		}

		await this.prismaService.client.following.delete({
			where: { id: following.id },
		});

		await this.decrementFollowing(following.follower, following.followee);

		// Publish unfollow event
		if (!silent && this.userEntityUtilService.isLocalUser(follower)) {
			this.userEntityService
				.packDetailed(followee.id, follower)
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

		if (
			this.userEntityUtilService.isLocalUser(follower) &&
			this.userEntityUtilService.isRemoteUser(followee)
		) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderUndo(
					this.apRendererService.renderFollow(
						follower as PartialLocalUser,
						followee as PartialRemoteUser,
					),
					follower,
				),
			);
			this.queueService.deliver(follower, content, followee.inbox, false);
		}

		if (
			this.userEntityUtilService.isLocalUser(followee) &&
			this.userEntityUtilService.isRemoteUser(follower)
		) {
			// local user has null host
			const content = this.apRendererService.addContext(
				this.apRendererService.renderReject(
					this.apRendererService.renderFollow(
						follower as PartialRemoteUser,
						followee as PartialLocalUser,
					),
					followee,
				),
			);
			this.queueService.deliver(followee, content, follower.inbox, false);
		}
	}

	private async decrementFollowing(
		follower: user,
		followee: user,
	): Promise<void> {
		this.globalEventService.publishInternalEvent('unfollow', {
			followerId: follower.id,
			followeeId: followee.id,
		});

		// Neither followee nor follower has moved.
		if (!follower.movedToUri && !followee.movedToUri) {
			//#region Decrement following / followers counts
			await Promise.all([
				this.prismaService.client.user.update({
					where: { id: follower.id },
					data: { followingCount: { decrement: 1 } },
				}),
				this.prismaService.client.user.update({
					where: { id: followee.id },
					data: { followersCount: { decrement: 1 } },
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
						data: { followingCount: { decrement: 1 } },
					});
					if (
						(await this.metaService.fetch()).enableChartsForFederatedInstances
					) {
						this.instanceChart.updateFollowing(i.host, false);
					}
				});
			} else if (
				this.userEntityUtilService.isLocalUser(follower) &&
				this.userEntityUtilService.isRemoteUser(followee)
			) {
				this.federatedInstanceService.fetch(followee.host).then(async (i) => {
					this.prismaService.client.instance.update({
						where: { id: i.id },
						data: { followersCount: { decrement: 1 } },
					});
					if (
						(await this.metaService.fetch()).enableChartsForFederatedInstances
					) {
						this.instanceChart.updateFollowers(i.host, false);
					}
				});
			}
			//#endregion

			this.perUserFollowingChart.update(follower, followee, false);
		} else {
			// Adjust following/followers counts
			for (const user of [follower, followee]) {
				if (user.movedToUri) continue; // No need to update if the user has already moved.

				const nonMovedFollowees =
					await this.prismaService.client.following.count({
						where: {
							followerId: user.id,
							followee: { movedToUri: null },
						},
					});
				const nonMovedFollowers =
					await this.prismaService.client.following.count({
						where: {
							followeeId: user.id,
							follower: { movedToUri: null },
						},
					});
				await this.prismaService.client.user.update({
					where: { id: user.id },
					data: {
						followingCount: nonMovedFollowees,
						followersCount: nonMovedFollowers,
					},
				});
			}

			// TODO: adjust charts
		}
	}
}
