import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { NODE_ENV } from '@/env.js';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import type { RelationshipJobData, ThinUser } from '@/queue/types.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { QueueService } from '@/core/QueueService.js';
import { RelayService } from '@/core/RelayService.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { CacheService } from '@/core/CacheService.js';
import { ProxyAccountService } from '@/core/ProxyAccountService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { MetaService } from '@/core/MetaService.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import type { Prisma, user } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class AccountMoveService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly apPersonService: ApPersonService,
		private readonly apRendererService: ApRendererService,
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly globalEventService: GlobalEventService,
		private readonly proxyAccountService: ProxyAccountService,
		private readonly perUserFollowingChart: PerUserFollowingChart,
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly instanceChart: InstanceChart,
		private readonly metaService: MetaService,
		private readonly relayService: RelayService,
		private readonly cacheService: CacheService,
		private readonly queueService: QueueService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * Move a local account to a new account.
	 *
	 * After delivering Move activity, its local followers unfollow the old account and then follow the new one.
	 */
	@bindThis
	public async moveFromLocal(
		src: LocalUser,
		dst: LocalUser | RemoteUser,
	): Promise<z.infer<typeof MeDetailedSchema>> {
		const srcUri = this.userEntityService.getUserUri(src);
		const dstUri = this.userEntityService.getUserUri(dst);

		// add movedToUri to indicate that the user has moved
		const alsoKnownAsArray = src.alsoKnownAs?.split(',') ?? [];
		const update: Prisma.userUncheckedUpdateInput = {
			alsoKnownAs: (alsoKnownAsArray.includes(dstUri) ? alsoKnownAsArray : [...alsoKnownAsArray, dstUri]).join(','),
			movedToUri: dstUri,
			movedAt: new Date(),
		};
		await this.prismaService.client.user.update({
			where: { id: src.id },
			data: update,
		});
		Object.assign(src, update);

		// Update cache
		this.cacheService.uriPersonCache.set(srcUri, src);

		const srcPerson = await this.apRendererService.renderPerson(src);
		const updateAct = this.apRendererService.addContext(this.apRendererService.renderUpdate(srcPerson, src));
		await this.apDeliverManagerService.deliverToFollowers(src, updateAct);
		await this.relayService.deliverToRelays(src, updateAct);

		// Deliver Move activity to the followers of the old account
		const moveAct = this.apRendererService.addContext(this.apRendererService.renderMove(src, dst));
		await this.apDeliverManagerService.deliverToFollowers(src, moveAct);

		// Publish meUpdated event
		const iObj = await this.userEntityService.packDetailedMe(src, { includeSecrets: true });
		this.globalEventService.publishMainStream(src.id, 'meUpdated', iObj);

		// Unfollow after 24 hours
		const followings = await this.prismaService.client.following.findMany({ where: { followerId: src.id } });
		await this.queueService.createDelayedUnfollowJob(followings.map(following => ({
			from: { id: src.id },
			to: { id: following.followeeId },
		})), NODE_ENV === 'test' ? 10000 : 1000 * 60 * 60 * 24);

		await this.postMoveProcess(src, dst);

		return iObj;
	}

	@bindThis
	public async postMoveProcess(src: user, dst: user): Promise<void> {
		// Copy blockings and mutings, and update lists
		try {
			await Promise.all([
				this.copyBlocking(src, dst),
				this.copyMutings(src, dst),
				this.updateLists(src, dst),
			]);
		} catch {
			/* skip if any error happens */
		}

		// follow the new account
		const proxy = await this.proxyAccountService.fetch();
		const followings = await this.prismaService.client.following.findMany({
			where: {
				followeeId: src.id,
				followerHost: null, // follower is local
				followerId: { not: proxy?.id },
			},
		});
		const followJobs = followings.map<RelationshipJobData>(following => ({
			from: { id: following.followerId },
			to: { id: dst.id },
		}));

		// Decrease following count instead of unfollowing.
		try {
			await this.adjustFollowingCounts(followJobs.map(job => job.from.id), src);
		} catch {
			/* skip if any error happens */
		}

		// Should be queued because this can cause a number of follow per one move.
		await this.queueService.createFollowJob(followJobs);
	}

	@bindThis
	public async copyBlocking(src: ThinUser, dst: ThinUser): Promise<void> {
		// Followers shouldn't overlap with blockers, but the destination account, different from the blockee (i.e., old account), may have followed the local user before moving.
		// So block the destination account here.

		const dstBlockings = await this.prismaService.client.blocking.findMany({
			where: { blockeeId: dst.id },
		});
		const srcBlockings = await this.prismaService.client.blocking.findMany({
			where: {
				blockeeId: src.id,
				blockerId: { notIn: dstBlockings.map(({ blockerId }) => blockerId) }, // skip
			},
		});

		// reblock the destination account
		const blockJobs = srcBlockings.map<RelationshipJobData>((srcBlocking) => ({
			from: { id: srcBlocking.blockerId },
			to: { id: dst.id },
		}));

		await this.queueService.createBlockJob(blockJobs);

		// no need to unblock the old account because it may be still functional
	}

	@bindThis
	public async copyMutings(src: ThinUser, dst: ThinUser): Promise<void> {
		const dstMutings = await this.prismaService.client.muting.findMany({
			where: { muteeId: dst.id, expiresAt: null },
		});

		const srcMutings = await this.prismaService.client.muting.findMany({
			where: {
				muteeId: src.id,
				OR: [
					{ expiresAt: null },
					{ expiresAt: { gt: new Date() } },
				],
				muterId: { notIn: dstMutings.map(({ muterId }) => muterId) } // skip
			},
		});
		if (srcMutings.length === 0) return;

		const newMutings = new Map<string, Omit<Prisma.mutingCreateManyInput, 'id'>>();

		// 重複しないようにIDを生成
		const genId = (): string => {
			let id: string;
			do {
				id = this.idService.genId();
			} while (newMutings.has(id));
			return id;
		};

		for (const muting of srcMutings) {
			newMutings.set(genId(), {
				...muting,
				createdAt: new Date(),
				muteeId: dst.id,
			});
		}

		const arrayToCreateMany: Prisma.mutingCreateManyInput[] = [...newMutings].map(entry => ({ ...entry[1], id: entry[0] }));
		await this.prismaService.client.muting.createMany({ data: arrayToCreateMany });
	}

	/**
	 * Update lists while moving accounts.
	 *   - No removal of the old account from the lists
	 *   - Users number limit is not checked
	 *
	 * @param src ThinUser (old account)
	 * @param dst User (new account)
	 * @returns {Promise<void>}
	 */
	@bindThis
	public async updateLists(src: ThinUser, dst: user): Promise<void> {
		const dstJoinings = await this.prismaService.client.user_list_joining.findMany({
			where: { userId: dst.id },
		});

		const srcJoinings = await this.prismaService.client.user_list_joining.findMany({
			where: {
				userId: src.id,
				userListId: { notIn: dstJoinings.map(({ userListId }) => userListId) }, // skip
			},
		});
		if (srcJoinings.length === 0) return;

		const newJoinings = new Map<string, Omit<Prisma.user_list_joiningCreateManyInput, 'id'>>();

		// 重複しないようにIDを生成
		const genId = (): string => {
			let id: string;
			do {
				id = this.idService.genId();
			} while (newJoinings.has(id));
			return id;
		};
		for (const joining of srcJoinings) {
			newJoinings.set(genId(), {
				createdAt: new Date(),
				userId: dst.id,
				userListId: joining.userListId,
			});
		}

		const arrayToInsert: Prisma.user_list_joiningCreateManyInput[] = [...newJoinings].map(entry => ({
			...entry[1],
			id: entry[0],
		}));
		await this.prismaService.client.user_list_joining.createMany({ data: arrayToInsert });

		// Have the proxy account follow the new account in the same way as UserListService.push
		if (this.userEntityService.isRemoteUser(dst)) {
			const proxy = await this.proxyAccountService.fetch();
			if (proxy) {
				await this.queueService.createFollowJob([{ from: { id: proxy.id }, to: { id: dst.id } }]);
			}
		}
	}

	@bindThis
	private async adjustFollowingCounts(localFollowerIds: string[], oldAccount: user): Promise<void> {
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
				where: { id: { in: oldFollowings.map((following) => following.followeeId) } },
				data: { followersCount: { decrement: 1 } }
			});
		}

		// Update instance stats by decreasing remote followers count by the number of local followers who were following the old account.
		if (this.userEntityService.isRemoteUser(oldAccount)) {
			const instance = await this.federatedInstanceService.fetch(oldAccount.host);
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
			await this.perUserFollowingChart.update({ id: followerId, host: null }, oldAccount, false);
		}
	}

	/**
	 * dstユーザーのalsoKnownAsをfetchPersonしていき、本当にmovedToUrlをdstに指定するユーザーが存在するのかを調べる
	 *
	 * @param dst movedToUrlを指定するユーザー
	 * @param check
	 * @param instant checkがtrueであるユーザーが最初に見つかったら即座にreturnするかどうか
	 * @returns {Promise<LocalUser | RemoteUser | null>}
	 */
	@bindThis
	public async validateAlsoKnownAs(
		dst_: LocalUser | RemoteUser,
		check: (oldUser: LocalUser | RemoteUser | null, newUser: LocalUser | RemoteUser) => boolean | Promise<boolean> = (): boolean => true,
		instant = false,
	): Promise<LocalUser | RemoteUser | null> {
		let resultUser: LocalUser | RemoteUser | null = null;

		const dst = await (async (): Promise<LocalUser | RemoteUser> => {
			if (this.userEntityService.isLocalUser(dst_)) {
				return dst_;
			} else {
				if (new Date().getTime() - (dst_.lastFetchedAt?.getTime() ?? 0) > 10 * 1000) {
					await this.apPersonService.updatePerson(dst_.uri);
				}
				return await this.apPersonService.fetchPerson(dst_.uri) ?? dst_;
			}
		})();

		if (!dst.alsoKnownAs) return null;
		if (dst.alsoKnownAs.split(',').length === 0) return null;

		const dstUri = this.userEntityService.getUserUri(dst);

		for (const srcUri of dst.alsoKnownAs.split(',')) {
			try {
				let src = await this.apPersonService.fetchPerson(srcUri);
				if (!src) continue; // oldAccountを探してもこのサーバーに存在しない場合はフォロー関係もないということなのでスルー

				if (this.userEntityService.isRemoteUser(dst)) {
					if ((new Date()).getTime() - (src.lastFetchedAt?.getTime() ?? 0) > 10 * 1000) {
						await this.apPersonService.updatePerson(srcUri);
					}

					src = await this.apPersonService.fetchPerson(srcUri) ?? src;
				}

				if (src.movedToUri === dstUri) {
					if (await check(resultUser, src)) {
						resultUser = src;
					}
					if (instant && resultUser) return resultUser;
				}
			} catch {
				/* skip if any error happens */
			}
		}

		return resultUser;
	}
}
