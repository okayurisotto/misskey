import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { LocalUser, RemoteUser, User } from '@/models/entities/User.js';
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
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

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
	public async moveFromLocal(src: LocalUser, dst: LocalUser | RemoteUser) {
		const srcUri = this.userEntityService.getUserUri(src);
		const dstUri = this.userEntityService.getUserUri(dst);

		// add movedToUri to indicate that the user has moved
		const alsoKnownAs = typeof src.alsoKnownAs === 'string' ? src.alsoKnownAs.split(',') : src.alsoKnownAs;
		const update: Omit<Partial<LocalUser>, 'alsoKnownAs'> & { alsoKnownAs: string[] } = {
			alsoKnownAs: alsoKnownAs?.includes(dstUri) ? alsoKnownAs : alsoKnownAs?.concat([dstUri]) ?? [dstUri],
			movedToUri: dstUri,
			movedAt: new Date(),
		};
		await this.prismaService.client.user.update({
			where: { id: src.id },
			data: {
				...update,
				alsoKnownAs: update.alsoKnownAs.join(','),
			},
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
		const iObj = await this.userEntityService.pack<true, true>(src.id, src, { detail: true, includeSecrets: true });
		this.globalEventService.publishMainStream(src.id, 'meUpdated', iObj);

		// Unfollow after 24 hours
		const followings = await this.prismaService.client.following.findMany({ where: { followerId: src.id } });
		await this.queueService.createDelayedUnfollowJob(followings.map(following => ({
			from: { id: src.id },
			to: { id: following.followeeId },
		})), process.env.NODE_ENV === 'test' ? 10000 : 1000 * 60 * 60 * 24);

		await this.postMoveProcess(src, dst);

		return iObj;
	}

	@bindThis
	public async postMoveProcess(src: T2P<User, user>, dst: T2P<User, user>): Promise<void> {
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
		const followJobs = followings.map(following => ({
			from: { id: following.followerId },
			to: { id: dst.id },
		})) as RelationshipJobData[];

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
		const srcBlockings = await this.prismaService.client.blocking.findMany({ where: { blockeeId: src.id } });
		const dstBlockings = await this.prismaService.client.blocking.findMany({ where: { blockeeId: dst.id } });
		const blockerIds = dstBlockings.map(blocking => blocking.blockerId);
		// reblock the destination account
		const blockJobs: RelationshipJobData[] = [];
		for (const blocking of srcBlockings) {
			if (blockerIds.includes(blocking.blockerId)) continue; // skip if already blocked
			blockJobs.push({ from: { id: blocking.blockerId }, to: { id: dst.id } });
		}
		// no need to unblock the old account because it may be still functional
		await this.queueService.createBlockJob(blockJobs);
	}

	@bindThis
	public async copyMutings(src: ThinUser, dst: ThinUser): Promise<void> {
		// Insert new mutings with the same values except mutee
		const oldMutings = await this.prismaService.client.muting.findMany({
			where: {
				OR: [
					{ muteeId: src.id, expiresAt: null },
					{ muteeId: src.id, expiresAt: { gt: new Date() } },
				]
			},
		});
		if (oldMutings.length === 0) return;

		// Check if the destination account is already indefinitely muted by the muter
		const existingMutingsMuterUserIds = await this.prismaService.client.muting.findMany({
			where: { muteeId: dst.id, expiresAt: null },
		}).then(mutings => mutings.map(muting => muting.muterId));

		const newMutings: Map<string, { muterId: string; muteeId: string; createdAt: Date; expiresAt: Date | null; }> = new Map();

		// 重複しないようにIDを生成
		const genId = (): string => {
			let id: string;
			do {
				id = this.idService.genId();
			} while (newMutings.has(id));
			return id;
		};
		for (const muting of oldMutings) {
			if (existingMutingsMuterUserIds.includes(muting.muterId)) continue; // skip if already muted indefinitely
			newMutings.set(genId(), {
				...muting,
				createdAt: new Date(),
				muteeId: dst.id,
			});
		}

		const arrayToInsert = Array.from(newMutings.entries()).map(entry => ({ ...entry[1], id: entry[0] }));
		await this.prismaService.client.muting.createMany({ data: arrayToInsert });
	}

	/**
	 * Update lists while moving accounts.
	 *   - No removal of the old account from the lists
	 *   - Users number limit is not checked
	 *
	 * @param src ThinUser (old account)
	 * @param dst User (new account)
	 * @returns Promise<void>
	 */
	@bindThis
	public async updateLists(src: ThinUser, dst: T2P<User, user>): Promise<void> {
		// Return if there is no list to be updated.
		const oldJoinings = await this.prismaService.client.user_list_joining.findMany({
			where: { userId: src.id },
		});
		if (oldJoinings.length === 0) return;

		const existingUserListIds = await this.prismaService.client.user_list_joining.findMany({
			where: { userId: dst.id },
		}).then(joinings => joinings.map(joining => joining.userListId));

		const newJoinings: Map<string, { createdAt: Date; userId: string; userListId: string; }> = new Map();

		// 重複しないようにIDを生成
		const genId = (): string => {
			let id: string;
			do {
				id = this.idService.genId();
			} while (newJoinings.has(id));
			return id;
		};
		for (const joining of oldJoinings) {
			if (existingUserListIds.includes(joining.userListId)) continue; // skip if dst exists in this user's list
			newJoinings.set(genId(), {
				createdAt: new Date(),
				userId: dst.id,
				userListId: joining.userListId,
			});
		}

		const arrayToInsert = Array.from(newJoinings.entries()).map(entry => ({ ...entry[1], id: entry[0] }));
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
	private async adjustFollowingCounts(localFollowerIds: string[], oldAccount: T2P<User, user>): Promise<void> {
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
			await this.federatedInstanceService.fetch(oldAccount.host).then(async i => {
				await this.prismaService.client.instance.update({
					where: { id: i.id },
					data: { followersCount: { decrement: localFollowerIds.length } },
				});
				if ((await this.metaService.fetch()).enableChartsForFederatedInstances) {
					await this.instanceChart.updateFollowers(i.host, false);
				}
			});
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
	 * @returns Promise<LocalUser | RemoteUser | null>
	 */
	@bindThis
	public async validateAlsoKnownAs(
		dst: LocalUser | RemoteUser,
		check: (oldUser: LocalUser | RemoteUser | null, newUser: LocalUser | RemoteUser) => boolean | Promise<boolean> = () => true,
		instant = false,
	): Promise<LocalUser | RemoteUser | null> {
		let resultUser: LocalUser | RemoteUser | null = null;

		if (this.userEntityService.isRemoteUser(dst)) {
			if ((new Date()).getTime() - (dst.lastFetchedAt?.getTime() ?? 0) > 10 * 1000) {
				await this.apPersonService.updatePerson(dst.uri);
			}
			dst = await this.apPersonService.fetchPerson(dst.uri) ?? dst;
		}

		if (!dst.alsoKnownAs) return null;
		if (Array.isArray(dst.alsoKnownAs) && dst.alsoKnownAs.length === 0) return null;
		if (typeof dst.alsoKnownAs === 'string' && dst.alsoKnownAs.split(',').length === 0) return null;

		const dstUri = this.userEntityService.getUserUri(dst);

		for (const srcUri of typeof dst.alsoKnownAs === 'string' ? dst.alsoKnownAs.split(',') : dst.alsoKnownAs) {
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
