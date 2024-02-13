import { Injectable } from '@nestjs/common';
import type { RelationshipJobData } from '@/queue/types.js';
import { QueueService } from '@/core/QueueService.js';
import { ProxyAccountService } from '@/core/ProxyAccountService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { MetaService } from '@/core/MetaService.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserBlockingCopyingService } from './UserBlockingCopyingService.js';
import { UserMutingCopyingService } from './UserMutingCopyingService.js';
import { UserListMovingUserService } from './UserListMovingUserService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { User } from '@prisma/client';

@Injectable()
export class AccountMovingPostProcessService {
	constructor(
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly instanceChart: InstanceChart,
		private readonly metaService: MetaService,
		private readonly perUserFollowingChart: PerUserFollowingChart,
		private readonly prismaService: PrismaService,
		private readonly proxyAccountService: ProxyAccountService,
		private readonly queueService: QueueService,
		private readonly userBlockingCopyingService: UserBlockingCopyingService,
		private readonly userEntityUtilService: UserEntityUtilService,
		private readonly userListMovingUserService: UserListMovingUserService,
		private readonly userMutingCopyingService: UserMutingCopyingService,
	) {}

	public async process(src: User, dst: User): Promise<void> {
		// Copy blockings and mutings, and update lists
		try {
			await Promise.all([
				this.userBlockingCopyingService.copy(src, dst),
				this.userMutingCopyingService.copy(src, dst),
				this.userListMovingUserService.move(src, dst),
			]);
		} catch {
			/* skip if any error happens */
		}

		// follow the new account
		const proxy = await this.proxyAccountService.fetch();
		const followings = await this.prismaService.client.following.findMany({
			where: {
				followeeId: src.id,
				followerId: { not: proxy?.id },
			},
		});
		const followJobs = followings.map<RelationshipJobData>((following) => ({
			from: { id: following.followerId },
			to: { id: dst.id },
		}));

		// Decrease following count instead of unfollowing.
		try {
			await this.adjustFollowingCounts(
				followJobs.map((job) => job.from.id),
				src,
			);
		} catch {
			/* skip if any error happens */
		}

		// Should be queued because this can cause a number of follow per one move.
		await this.queueService.createFollowJob(followJobs);
	}

	private async adjustFollowingCounts(
		localFollowerIds: string[],
		oldAccount: User,
	): Promise<void> {
		if (localFollowerIds.length === 0) return;

		// Set the old account's following and followers counts to 0.
		await this.prismaService.client.user.update({
			where: { id: oldAccount.id },
			data: { followersCount: 0, followingCount: 0 },
		});

		// Decrease following counts of local followers by 1.
		await this.prismaService.client.user.updateMany({
			where: { id: { in: localFollowerIds } },
			data: { followingCount: { decrement: 1 } },
		});

		// Decrease follower counts of local followees by 1.
		const oldFollowings = await this.prismaService.client.following.findMany({
			where: { followerId: oldAccount.id },
		});
		if (oldFollowings.length > 0) {
			await this.prismaService.client.user.updateMany({
				where: {
					id: { in: oldFollowings.map((following) => following.followeeId) },
				},
				data: { followersCount: { decrement: 1 } },
			});
		}

		// Update instance stats by decreasing remote followers count by the number of local followers who were following the old account.
		if (this.userEntityUtilService.isRemoteUser(oldAccount)) {
			const instance = await this.federatedInstanceService.fetch(
				oldAccount.host,
			);
			await this.prismaService.client.instance.update({
				where: { id: instance.id },
				data: { followersCount: { decrement: localFollowerIds.length } },
			});
			if ((await this.metaService.fetch()).enableChartsForFederatedInstances) {
				await this.instanceChart.updateFollowers(instance.host, false);
			}
		}

		// FIXME: expensive?
		for (const followerId of localFollowerIds) {
			await this.perUserFollowingChart.update(
				{ id: followerId, host: null },
				oldAccount,
				false,
			);
		}
	}
}
