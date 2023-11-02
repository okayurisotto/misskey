import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LocalUser, PartialLocalUser, PartialRemoteUser, RemoteUser } from '@/models/entities/User.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { QueueService } from '@/core/QueueService.js';
import PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdService } from '@/core/IdService.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { WebhookService } from '@/core/WebhookService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { bindThis } from '@/decorators.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import { MetaService } from '@/core/MetaService.js';
import { CacheService } from '@/core/CacheService.js';
import type { Config } from '@/config.js';
import { AccountMoveService } from '@/core/AccountMoveService.js';
import type { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import Logger from '../logger.js';
import type { z } from 'zod';
import type { user } from '@prisma/client';

const logger = new Logger('following/create');

type Local = LocalUser | {
	id: LocalUser['id'];
	host: LocalUser['host'];
	uri: LocalUser['uri']
};
type Remote = RemoteUser | {
	id: RemoteUser['id'];
	host: RemoteUser['host'];
	uri: RemoteUser['uri'];
	inbox: RemoteUser['inbox'];
};
type Both = Local | Remote;

@Injectable()
export class UserFollowingService implements OnModuleInit {
	private userBlockingService: UserBlockingService;

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.config)
		private config: Config,

		private readonly cacheService: CacheService,
		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly queueService: QueueService,
		private readonly globalEventService: GlobalEventService,
		private readonly metaService: MetaService,
		private readonly notificationService: NotificationService,
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly webhookService: WebhookService,
		private readonly apRendererService: ApRendererService,
		private readonly accountMoveService: AccountMoveService,
		private readonly perUserFollowingChart: PerUserFollowingChart,
		private readonly instanceChart: InstanceChart,
		private readonly prismaService: PrismaService,
	) {}

	onModuleInit(): void {
		this.userBlockingService = this.moduleRef.get('UserBlockingService');
	}

	@bindThis
	public async follow(_follower: { id: user['id'] }, _followee: { id: user['id'] }, requestId?: string, silent = false): Promise<void> {
		const [follower, followee] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: _follower.id } }),
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: _followee.id } }),
		]) as [LocalUser | RemoteUser, LocalUser | RemoteUser];

		// check blocking
		const [blocking, blocked] = await Promise.all([
			this.userBlockingService.checkBlocked(follower.id, followee.id),
			this.userBlockingService.checkBlocked(followee.id, follower.id),
		]);

		if (this.userEntityService.isRemoteUser(follower) && this.userEntityService.isLocalUser(followee) && blocked) {
			// リモートフォローを受けてブロックしていた場合は、エラーにするのではなくRejectを送り返しておしまい。
			const content = this.apRendererService.addContext(this.apRendererService.renderReject(this.apRendererService.renderFollow(follower, followee, requestId), followee));
			this.queueService.deliver(followee, content, follower.inbox, false);
			return;
		} else if (this.userEntityService.isRemoteUser(follower) && this.userEntityService.isLocalUser(followee) && blocking) {
			// リモートフォローを受けてブロックされているはずの場合だったら、ブロック解除しておく。
			await this.userBlockingService.unblock(follower, followee);
		} else {
			// それ以外は単純に例外
			if (blocking) throw new IdentifiableError('710e8fb0-b8c3-4922-be49-d5d93d8e6a6e', 'blocking');
			if (blocked) throw new IdentifiableError('3338392a-f764-498d-8855-db939dcf8c48', 'blocked');
		}

		const followeeProfile = await this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: followee.id } });

		// フォロー対象が鍵アカウントである or
		// フォロワーがBotであり、フォロー対象がBotからのフォローに慎重である or
		// フォロワーがローカルユーザーであり、フォロー対象がリモートユーザーである
		// 上記のいずれかに当てはまる場合はすぐフォローせずにフォローリクエストを発行しておく
		if (followee.isLocked || (followeeProfile.carefulBot && follower.isBot) || (this.userEntityService.isLocalUser(follower) && this.userEntityService.isRemoteUser(followee))) {
			let autoAccept = false;

			// 鍵アカウントであっても、既にフォローされていた場合はスルー
			const isFollowing = (await this.prismaService.client.following.count({
				where: {
					followerId: follower.id,
					followeeId: followee.id,
				},
				take: 1,
			})) > 0;
			if (isFollowing) {
				autoAccept = true;
			}

			// フォローしているユーザーは自動承認オプション
			if (!autoAccept && (this.userEntityService.isLocalUser(followee) && followeeProfile.autoAcceptFollowed)) {
				const isFollowed = (await this.prismaService.client.following.count({
					where: {
						followerId: followee.id,
						followeeId: follower.id,
					},
					take: 1,
				})) > 0;

				if (isFollowed) autoAccept = true;
			}

			// Automatically accept if the follower is an account who has moved and the locked followee had accepted the old account.
			if (followee.isLocked && !autoAccept) {
				autoAccept = !!(await this.accountMoveService.validateAlsoKnownAs(
					follower,
					async (oldSrc, newSrc) => (await this.prismaService.client.following.count({
						where: {
							followeeId: followee.id,
							followerId: newSrc.id,
						},
						take: 1,
					})) > 0,
					true,
				));
			}

			if (!autoAccept) {
				await this.createFollowRequest(follower, followee, requestId);
				return;
			}
		}

		await this.insertFollowingDoc(followee, follower, silent);

		if (this.userEntityService.isRemoteUser(follower) && this.userEntityService.isLocalUser(followee)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderAccept(this.apRendererService.renderFollow(follower, followee, requestId), followee));
			this.queueService.deliver(followee, content, follower.inbox, false);
		}
	}

	@bindThis
	private async insertFollowingDoc(
		followee: {
			id: user['id']; host: user['host']; uri: user['host']; inbox: user['inbox']; sharedInbox: user['sharedInbox']
		},
		follower: {
			id: user['id']; host: user['host']; uri: user['host']; inbox: user['inbox']; sharedInbox: user['sharedInbox']
		},
		silent = false,
	): Promise<void> {
		if (follower.id === followee.id) return;

		let alreadyFollowed = false as boolean;

		await this.prismaService.client.following.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				followerId: follower.id,
				followeeId: followee.id,

				// 非正規化
				followerHost: follower.host,
				followerInbox: this.userEntityService.isRemoteUser(follower) ? follower.inbox : null,
				followerSharedInbox: this.userEntityService.isRemoteUser(follower) ? follower.sharedInbox : null,
				followeeHost: followee.host,
				followeeInbox: this.userEntityService.isRemoteUser(followee) ? followee.inbox : null,
				followeeSharedInbox: this.userEntityService.isRemoteUser(followee) ? followee.sharedInbox : null,
			},
		}).catch(err => {
			if (isDuplicateKeyValueError(err) && this.userEntityService.isRemoteUser(follower) && this.userEntityService.isLocalUser(followee)) {
				logger.info(`Insert duplicated ignore. ${follower.id} => ${followee.id}`);
				alreadyFollowed = true;
			} else {
				throw err;
			}
		});

		this.cacheService.userFollowingsCache.refresh(follower.id);

		const requestExist = (await this.prismaService.client.follow_request.count({
			where: {
				followeeId: followee.id,
				followerId: follower.id,
			},
			take: 1,
		})) > 0;

		if (requestExist) {
			await this.prismaService.client.follow_request.delete({
				where: {
					followerId_followeeId: {
						followeeId: followee.id,
						followerId: follower.id,
					},
				},
			});

			// 通知を作成
			this.notificationService.createNotification(follower.id, 'followRequestAccepted', {
				notifierId: followee.id,
			});
		}

		if (alreadyFollowed) return;

		this.globalEventService.publishInternalEvent('follow', { followerId: follower.id, followeeId: followee.id });

		const [followeeUser, followerUser] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: followee.id } }),
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: follower.id } }),
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
			if (this.userEntityService.isRemoteUser(follower) && this.userEntityService.isLocalUser(followee)) {
				this.federatedInstanceService.fetch(follower.host).then(async i => {
					this.prismaService.client.instance.update({
						where: { id: i.id },
						data: { followingCount: { increment: 1 } },
					});
					if ((await this.metaService.fetch()).enableChartsForFederatedInstances) {
						this.instanceChart.updateFollowing(i.host, true);
					}
				});
			} else if (this.userEntityService.isLocalUser(follower) && this.userEntityService.isRemoteUser(followee)) {
				this.federatedInstanceService.fetch(followee.host).then(async i => {
					this.prismaService.client.instance.update({
						where: { id: i.id },
						data: { followersCount: { increment: 1 } },
					});
					if ((await this.metaService.fetch()).enableChartsForFederatedInstances) {
						this.instanceChart.updateFollowers(i.host, true);
					}
				});
			}
			//#endregion

			this.perUserFollowingChart.update(follower, followee, true);
		}

		// Publish follow event
		if (this.userEntityService.isLocalUser(follower) && !silent) {
			this.userEntityService.packDetailed(followee.id, follower).then(async packed => {
				this.globalEventService.publishMainStream(follower.id, 'follow', packed as z.infer<typeof UserDetailedNotMeSchema>);

				const webhooks = (await this.webhookService.getActiveWebhooks()).filter(x => x.userId === follower.id && x.on.includes('follow'));
				for (const webhook of webhooks) {
					this.queueService.webhookDeliver(webhook, 'follow', {
						user: packed,
					});
				}
			});
		}

		// Publish followed event
		if (this.userEntityService.isLocalUser(followee)) {
			const followerAsUser = await this.prismaService.client.user.findUniqueOrThrow({ where: { id: follower.id } });
			this.userEntityService.packLite(followerAsUser).then(async packed => {
				this.globalEventService.publishMainStream(followee.id, 'followed', packed);

				const webhooks = (await this.webhookService.getActiveWebhooks()).filter(x => x.userId === followee.id && x.on.includes('followed'));
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

	@bindThis
	public async unfollow(
		follower: {
			id: user['id']; host: user['host']; uri: user['host']; inbox: user['inbox']; sharedInbox: user['sharedInbox'];
		},
		followee: {
			id: user['id']; host: user['host']; uri: user['host']; inbox: user['inbox']; sharedInbox: user['sharedInbox'];
		},
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
				user_following_followerIdTouser: true,
				user_following_followeeIdTouser: true,
			}
		});

		if (following === null) {
			logger.warn('フォロー解除がリクエストされましたがフォローしていませんでした');
			return;
		}

		await this.prismaService.client.following.delete({ where: { id: following.id } });

		this.cacheService.userFollowingsCache.refresh(follower.id);

		await this.decrementFollowing(following.user_following_followerIdTouser, following.user_following_followeeIdTouser);

		// Publish unfollow event
		if (!silent && this.userEntityService.isLocalUser(follower)) {
			this.userEntityService.packDetailed(followee.id, follower).then(async packed => {
				this.globalEventService.publishMainStream(follower.id, 'unfollow', packed);

				const webhooks = (await this.webhookService.getActiveWebhooks()).filter(x => x.userId === follower.id && x.on.includes('unfollow'));
				for (const webhook of webhooks) {
					this.queueService.webhookDeliver(webhook, 'unfollow', {
						user: packed,
					});
				}
			});
		}

		if (this.userEntityService.isLocalUser(follower) && this.userEntityService.isRemoteUser(followee)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderUndo(this.apRendererService.renderFollow(follower as PartialLocalUser, followee as PartialRemoteUser), follower));
			this.queueService.deliver(follower, content, followee.inbox, false);
		}

		if (this.userEntityService.isLocalUser(followee) && this.userEntityService.isRemoteUser(follower)) {
			// local user has null host
			const content = this.apRendererService.addContext(this.apRendererService.renderReject(this.apRendererService.renderFollow(follower as PartialRemoteUser, followee as PartialLocalUser), followee));
			this.queueService.deliver(followee, content, follower.inbox, false);
		}
	}

	@bindThis
	private async decrementFollowing(
		follower: user,
		followee: user,
	): Promise<void> {
		this.globalEventService.publishInternalEvent('unfollow', { followerId: follower.id, followeeId: followee.id });

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
			if (this.userEntityService.isRemoteUser(follower) && this.userEntityService.isLocalUser(followee)) {
				this.federatedInstanceService.fetch(follower.host).then(async i => {
					this.prismaService.client.instance.update({
						where: { id: i.id },
						data: { followingCount: { decrement: 1 } },
					});
					if ((await this.metaService.fetch()).enableChartsForFederatedInstances) {
						this.instanceChart.updateFollowing(i.host, false);
					}
				});
			} else if (this.userEntityService.isLocalUser(follower) && this.userEntityService.isRemoteUser(followee)) {
				this.federatedInstanceService.fetch(followee.host).then(async i => {
					this.prismaService.client.instance.update({
						where: { id: i.id },
						data: { followersCount: { decrement: 1 } },
					});
					if ((await this.metaService.fetch()).enableChartsForFederatedInstances) {
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

				const nonMovedFollowees = await this.prismaService.client.following.count({
					where: {
						followerId: user.id,
						user_following_followeeIdTouser: {
							movedToUri: null,
						},
					},
				});
				const nonMovedFollowers = await this.prismaService.client.following.count({
					where: {
						followeeId: user.id,
						user_following_followerIdTouser: {
							movedToUri: null,
						},
					},
				});
				await this.prismaService.client.user.update({
					where: { id: user.id },
					data: { followingCount: nonMovedFollowees, followersCount: nonMovedFollowers },
				});
			}

			// TODO: adjust charts
		}
	}

	@bindThis
	public async createFollowRequest(
		follower: {
			id: user['id']; host: user['host']; uri: user['host']; inbox: user['inbox']; sharedInbox: user['sharedInbox'];
		},
		followee: {
			id: user['id']; host: user['host']; uri: user['host']; inbox: user['inbox']; sharedInbox: user['sharedInbox'];
		},
		requestId?: string,
	): Promise<void> {
		if (follower.id === followee.id) return;

		// check blocking
		const [blocking, blocked] = await Promise.all([
			this.userBlockingService.checkBlocked(follower.id, followee.id),
			this.userBlockingService.checkBlocked(followee.id, follower.id),
		]);

		if (blocking) throw new Error('blocking');
		if (blocked) throw new Error('blocked');

		const followRequest = await this.prismaService.client.follow_request.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				followerId: follower.id,
				followeeId: followee.id,
				requestId,

				// 非正規化
				followerHost: follower.host,
				followerInbox: this.userEntityService.isRemoteUser(follower) ? follower.inbox : undefined,
				followerSharedInbox: this.userEntityService.isRemoteUser(follower) ? follower.sharedInbox : undefined,
				followeeHost: followee.host,
				followeeInbox: this.userEntityService.isRemoteUser(followee) ? followee.inbox : undefined,
				followeeSharedInbox: this.userEntityService.isRemoteUser(followee) ? followee.sharedInbox : undefined,
			},
		});

		// Publish receiveRequest event
		if (this.userEntityService.isLocalUser(followee)) {
			const followerAsUser = await this.prismaService.client.user.findUniqueOrThrow({ where: { id: follower.id } });
			this.userEntityService.packLite(followerAsUser).then(packed => this.globalEventService.publishMainStream(followee.id, 'receiveFollowRequest', packed));

			this.userEntityService.packDetailed(followee.id, followee).then(packed => this.globalEventService.publishMainStream(followee.id, 'meUpdated', packed));

			// 通知を作成
			this.notificationService.createNotification(followee.id, 'receiveFollowRequest', {
				notifierId: follower.id,
				followRequestId: followRequest.id,
			});
		}

		if (this.userEntityService.isLocalUser(follower) && this.userEntityService.isRemoteUser(followee)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderFollow(follower as PartialLocalUser, followee as PartialRemoteUser, requestId ?? `${this.config.url}/follows/${followRequest.id}`));
			this.queueService.deliver(follower, content, followee.inbox, false);
		}
	}

	@bindThis
	public async cancelFollowRequest(
		followee: {
			id: user['id']; host: user['host']; uri: user['host']; inbox: user['inbox']
		},
		follower: {
			id: user['id']; host: user['host']; uri: user['host']
		},
	): Promise<void> {
		if (this.userEntityService.isRemoteUser(followee)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderUndo(this.apRendererService.renderFollow(follower as PartialLocalUser | PartialRemoteUser, followee as PartialRemoteUser), follower));

			if (this.userEntityService.isLocalUser(follower)) { // 本来このチェックは不要だけどTSに怒られるので
				this.queueService.deliver(follower, content, followee.inbox, false);
			}
		}

		const requestExist = (await this.prismaService.client.follow_request.count({
			where: {
				followeeId: followee.id,
				followerId: follower.id,
			},
			take: 1,
		})) > 0;

		if (!requestExist) {
			throw new IdentifiableError('17447091-ce07-46dd-b331-c1fd4f15b1e7', 'request not found');
		}

		await this.prismaService.client.follow_request.delete({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		this.userEntityService.packDetailed(followee.id, followee).then(packed => this.globalEventService.publishMainStream(followee.id, 'meUpdated', packed));
	}

	@bindThis
	public async acceptFollowRequest(
		followee: {
			id: user['id']; host: user['host']; uri: user['host']; inbox: user['inbox']; sharedInbox: user['sharedInbox'];
		},
		follower: user,
	): Promise<void> {
		const request = await this.prismaService.client.follow_request.findUnique({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		if (request == null) {
			throw new IdentifiableError('8884c2dd-5795-4ac9-b27e-6a01d38190f9', 'No follow request.');
		}

		await this.insertFollowingDoc(followee, follower);

		if (this.userEntityService.isRemoteUser(follower) && this.userEntityService.isLocalUser(followee)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderAccept(this.apRendererService.renderFollow(follower, followee as PartialLocalUser, request.requestId!), followee));
			this.queueService.deliver(followee, content, follower.inbox, false);
		}

		this.userEntityService.packDetailed(followee.id, followee).then(packed => this.globalEventService.publishMainStream(followee.id, 'meUpdated', packed));
	}

	@bindThis
	public async acceptAllFollowRequests(
		user: {
			id: user['id']; host: user['host']; uri: user['host']; inbox: user['inbox']; sharedInbox: user['sharedInbox'];
		},
	): Promise<void> {
		const requests = await this.prismaService.client.follow_request.findMany({
			where: {
				followeeId: user.id,
			},
		});

		for (const request of requests) {
			const follower = await this.prismaService.client.user.findUniqueOrThrow({ where: { id: request.followerId } });
			await this.acceptFollowRequest(user, follower);
		}
	}

	/**
	 * API following/request/reject
	 */
	@bindThis
	public async rejectFollowRequest(user: Local, follower: Both): Promise<void> {
		if (this.userEntityService.isRemoteUser(follower)) {
			await this.deliverReject(user, follower);
		}

		await this.removeFollowRequest(user, follower);

		if (this.userEntityService.isLocalUser(follower)) {
			await this.publishUnfollow(user, follower);
		}
	}

	/**
	 * API following/reject
	 */
	@bindThis
	public async rejectFollow(user: Local, follower: Both): Promise<void> {
		if (this.userEntityService.isRemoteUser(follower)) {
			await this.deliverReject(user, follower);
		}

		await this.removeFollow(user, follower);

		if (this.userEntityService.isLocalUser(follower)) {
			await this.publishUnfollow(user, follower);
		}
	}

	/**
	 * AP Reject/Follow
	 */
	@bindThis
	public async remoteReject(actor: Remote, follower: Local): Promise<void> {
		await this.removeFollowRequest(actor, follower);
		await this.removeFollow(actor, follower);
		await this.publishUnfollow(actor, follower);
	}

	/**
	 * Remove follow request record
	 */
	@bindThis
	private async removeFollowRequest(followee: Both, follower: Both): Promise<void> {
		const request = await this.prismaService.client.follow_request.findUnique({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		if (!request) return;

		await this.prismaService.client.follow_request.delete({ where: { id: request.id } });
	}

	/**
	 * Remove follow record
	 */
	@bindThis
	private async removeFollow(followee: Both, follower: Both): Promise<void> {
		const following = await this.prismaService.client.following.findUnique({
			include: {
				user_following_followeeIdTouser: true,
				user_following_followerIdTouser: true,
			},
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		if (!following) return;

		await this.prismaService.client.following.delete({ where: { id: following.id } });

		await this.decrementFollowing(following.user_following_followerIdTouser, following.user_following_followeeIdTouser);
	}

	/**
	 * Deliver Reject to remote
	 */
	@bindThis
	private async deliverReject(followee: Local, follower: Remote): Promise<void> {
		const request = await this.prismaService.client.follow_request.findUnique({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		const content = this.apRendererService.addContext(this.apRendererService.renderReject(this.apRendererService.renderFollow(follower, followee, request?.requestId ?? undefined), followee));
		this.queueService.deliver(followee, content, follower.inbox, false);
	}

	/**
	 * Publish unfollow to local
	 */
	@bindThis
	private async publishUnfollow(followee: Both, follower: Local): Promise<void> {
		const packedFollowee = await this.userEntityService.packDetailed(followee.id, follower);

		this.globalEventService.publishMainStream(follower.id, 'unfollow', packedFollowee);

		const webhooks = (await this.webhookService.getActiveWebhooks()).filter(x => x.userId === follower.id && x.on.includes('unfollow'));
		for (const webhook of webhooks) {
			this.queueService.webhookDeliver(webhook, 'unfollow', {
				user: packedFollowee,
			});
		}
	}
}
