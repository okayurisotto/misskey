import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { ModuleRef } from '@nestjs/core';
import { pick } from 'omick';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { USER_ACTIVE_THRESHOLD, USER_ONLINE_THRESHOLD } from '@/const.js';
import type { LocalUser, PartialLocalUser, PartialRemoteUser, RemoteUser } from '@/models/entities/User.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import type { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import type { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import type { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import type { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import type { UserSchema } from '@/models/zod/UserSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { InstanceEntityService } from './InstanceEntityService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { CustomEmojiService } from '../CustomEmojiService.js';
import type { NoteEntityService } from './NoteEntityService.js';
import type { DriveFileEntityService } from './DriveFileEntityService.js';
import type { PageEntityService } from './PageEntityService.js';
import type { z } from 'zod';
import type { instance, user, user_profile } from '@prisma/client';

type IsMeAndIsUserDetailed<ExpectsMe extends boolean | null, Detailed extends boolean> =
	Detailed extends true ?
		ExpectsMe extends true ? z.infer<typeof MeDetailedSchema> :
		ExpectsMe extends false ? z.infer<typeof UserDetailedNotMeSchema> :
		z.infer<typeof UserDetailedSchema> :
	z.infer<typeof UserLiteSchema>;

function isLocalUser(user: user): user is LocalUser;
function isLocalUser<T extends { host: user['host'] }>(user: T): user is (T & { host: null; });
function isLocalUser(user: user | { host: user['host'] }): boolean {
	return user.host == null;
}

function isRemoteUser(user: user): user is RemoteUser;
function isRemoteUser<T extends { host: user['host'] }>(user: T): user is (T & { host: string; });
function isRemoteUser(user: user | { host: user['host'] }): boolean {
	return !isLocalUser(user);
}

@Injectable()
export class UserEntityService implements OnModuleInit {
	private apPersonService: ApPersonService;
	private noteEntityService: NoteEntityService;
	private driveFileEntityService: DriveFileEntityService;
	private pageEntityService: PageEntityService;
	private customEmojiService: CustomEmojiService;
	private roleService: RoleService;
	private federatedInstanceService: FederatedInstanceService;
	private instanceEntityService: InstanceEntityService;

	constructor(
		private readonly moduleRef: ModuleRef,

		@Inject(DI.config)
		private readonly config: Config,

		@Inject(DI.redis)
		private readonly redisClient: Redis.Redis,

		private readonly prismaService: PrismaService,
	) {}

	onModuleInit(): void {
		this.apPersonService = this.moduleRef.get('ApPersonService');
		this.noteEntityService = this.moduleRef.get('NoteEntityService');
		this.driveFileEntityService = this.moduleRef.get('DriveFileEntityService');
		this.pageEntityService = this.moduleRef.get('PageEntityService');
		this.customEmojiService = this.moduleRef.get('CustomEmojiService');
		this.roleService = this.moduleRef.get('RoleService');
		this.federatedInstanceService = this.moduleRef.get('FederatedInstanceService');
		this.instanceEntityService = this.moduleRef.get('InstanceEntityService');
	}

	public isLocalUser = isLocalUser;
	public isRemoteUser = isRemoteUser;

	/**
	 * `me`と`target`の関係を取得する。
	 *
	 * @param me
	 * @param target
	 * @returns
	 */
	@bindThis
	public async getRelation(
		me: user['id'],
		target: user['id'],
	): Promise<{
		id: string;
		isFollowing: boolean;
		isFollowed: boolean;
		hasPendingFollowRequestFromYou: boolean;
		hasPendingFollowRequestToYou: boolean;
		isBlocking: boolean;
		isBlocked: boolean;
		isMuted: boolean;
		isRenoteMuted: boolean;
	}> {
		const result = await awaitAll({
			isFollowing: (): Promise<boolean> =>
				this.prismaService.client.following.count({
					where: { followerId: me, followeeId: target },
					take: 1,
				}).then(n => n > 0),
			isFollowed: (): Promise<boolean> =>
				this.prismaService.client.following.count({
					where: { followerId: target, followeeId: me },
					take: 1,
				}).then(n => n > 0),
			hasPendingFollowRequestFromYou: (): Promise<boolean> =>
				this.prismaService.client.follow_request.count({
					where: { followerId: me, followeeId: target },
					take: 1,
				}).then(n => n > 0),
			hasPendingFollowRequestToYou: (): Promise<boolean> =>
				this.prismaService.client.follow_request.count({
					where: { followerId: target, followeeId: me },
					take: 1,
				}).then(n => n > 0),
			isBlocking: (): Promise<boolean> =>
				this.prismaService.client.blocking.count({
					where: { blockerId: me, blockeeId: target },
					take: 1,
				}).then(n => n > 0),
			isBlocked: (): Promise<boolean> =>
				this.prismaService.client.blocking.count({
					where: { blockerId: target, blockeeId: me },
					take: 1,
				}).then(n => n > 0),
			isMuted: (): Promise<boolean> =>
				this.prismaService.client.muting.count({
					where: { muterId: me, muteeId: target },
					take: 1,
				}).then(n => n > 0),
			isRenoteMuted: (): Promise<boolean> =>
				this.prismaService.client.renote_muting.count({
					where: { muterId: me, muteeId: target },
					take: 1,
				}).then(n => n > 0),
		});

		return {
			id: target,
			...result,
		};
	}

	/**
	 * そのユーザーがまだ読んでいない`announcement`があるかどうか調べる。
	 *
	 * @param userId
	 * @returns
	 */
	@bindThis
	public async getHasUnreadAnnouncement(userId: user['id']): Promise<boolean> {
		const reads = await this.prismaService.client.announcement_read.findMany({
			where: { userId: userId },
		});

		const count = await this.prismaService.client.announcement.count({
			where: reads.length > 0
				? { id: { notIn: reads.map((read) => read.announcementId) } }
				: {},
			take: 1,
		});

		return count > 0;
	}

	/**
	 * そのユーザーがまだ読んでいない`antenna`があるかどうか調べる。
	 * 未実装
	 *
	 * @param userId 使われていない
	 * @returns
	 */
	@bindThis
	public async getHasUnreadAntenna(userId: user['id']): Promise<boolean> {
		return false;
	}

	/**
	 * そのユーザーがまだ読んでいない`notification`があるかどうか調べる。
	 *
	 * @param userId
	 * @returns
	 */
	@bindThis
	public async getHasUnreadNotification(userId: user['id']): Promise<boolean> {
		const latestReadNotificationId = await this.redisClient.get(`latestReadNotification:${userId}`);

		const latestNotificationIdsRes = await this.redisClient.xrevrange(
			`notificationTimeline:${userId}`,
			'+',
			'-',
			'COUNT', 1);
		const latestNotificationId = latestNotificationIdsRes.at(0)?.at(0);

		return latestNotificationId != null && (latestReadNotificationId == null || latestReadNotificationId < latestNotificationId);
	}

	/**
	 * そのユーザーがまだ解決していない`follow_request`があるか調べる。
	 *
	 * @param userId
	 * @returns
	 */
	@bindThis
	public async getHasPendingReceivedFollowRequest(userId: user['id']): Promise<boolean> {
		const count = await this.prismaService.client.follow_request.count({
			where: { followeeId: userId },
			take: 1,
		});

		return count > 0;
	}

	/**
	 * そのユーザーのオンライン状態を取得する。
	 *
	 * @param user
	 * @returns
	 */
	@bindThis
	public getOnlineStatus(user: user): 'unknown' | 'online' | 'active' | 'offline' {
		if (user.hideOnlineStatus) return 'unknown';
		if (user.lastActiveDate == null) return 'unknown';
		const elapsed = Date.now() - user.lastActiveDate.getTime();
		return (
			elapsed < USER_ONLINE_THRESHOLD ? 'online' :
			elapsed < USER_ACTIVE_THRESHOLD ? 'active' :
			'offline'
		);
	}

	/**
	 * `user`からidenticonのURLを得る。
	 *
	 * @param user
	 * @returns
	 */
	@bindThis
	public getIdenticonUrl(user: user): string {
		return `${this.config.url}/identicon/${user.username.toLowerCase()}@${user.host ?? this.config.host}`;
	}

	/**
	 * `user`からそのユーザーを表示するURLを得る
	 *
	 * @param user
	 * @returns
	 */
	@bindThis
	public getUserUri(user: LocalUser | PartialLocalUser | RemoteUser | PartialRemoteUser): string {
		return this.isRemoteUser(user)
			? user.uri : this.genLocalUserUri(user.id);
	}

	/**
	 * `LocalUser`の`userId`からそのユーザーを表示するURLを得る
	 *
	 * @param userId
	 * @returns
	 */
	@bindThis
	public genLocalUserUri(userId: string): string {
		return `${this.config.url}/users/${userId}`;
	}

	public async migrate(user: user): Promise<void> {
		if (user.avatarId !== null && user.avatarUrl === null) {
			const avatar = await this.prismaService.client.drive_file.findUniqueOrThrow({ where: { id: user.avatarId } });
			const avatarUrl = this.driveFileEntityService.getPublicUrl(avatar, 'avatar');
			this.prismaService.client.user.update({
				where: { id: user.id },
				data: {
					avatarUrl: avatarUrl,
					avatarBlurhash: avatar.blurhash,
				},
			});
		}

		if (user.bannerId !== null && user.bannerUrl === null) {
			const banner = await this.prismaService.client.drive_file.findUniqueOrThrow({ where: { id: user.bannerId } });
			const bannerUrl = this.driveFileEntityService.getPublicUrl(banner);
			this.prismaService.client.user.update({
				where: { id: user.id },
				data: {
					bannerUrl: bannerUrl,
					bannerBlurhash: banner.blurhash,
				},
			});
		}
	}

	async getInstance(user: user): Promise<instance | undefined> {
		if (user.host === null) return undefined;

		const instance = await this.federatedInstanceService.federatedInstanceCache.fetch(user.host);
		if (instance === null) return undefined;

		return instance;
	}

	public async packLite(src: user['id'] | user): Promise<z.infer<typeof UserLiteSchema>> {
		const user = typeof src === 'object' ? src : await this.prismaService.client.user.findUniqueOrThrow({ where: { id: src } });

		await this.migrate(user);

		const [instance, badgeRoles, emojis] = await Promise.all([
			this.getInstance(user),
			user.host === null // パフォーマンス上の理由でローカルユーザーのみ
				? this.roleService.getUserBadgeRoles(user.id).then(rs => rs
						.sort((a, b) => b.displayOrder - a.displayOrder)
						.map(r => ({
							name: r.name,
							iconUrl: r.iconUrl,
							displayOrder: r.displayOrder,
						}))
					)
				: Promise.resolve(undefined),
			this.customEmojiService.populateEmojis(user.emojis, user.host),
		]);

		return {
			...pick(user, ['id', 'name', 'username', 'host', 'avatarBlurhash', 'isBot', 'isCat']),

			emojis: emojis,
			badgeRoles: badgeRoles,

			avatarUrl: user.avatarUrl ?? this.getIdenticonUrl(user),
			instance: instance !== undefined ? this.instanceEntityService.packLite(instance) : undefined,
			onlineStatus: this.getOnlineStatus(user),
		};
	}

	public async pack<ExpectsMe extends boolean | null, D extends true>(
		src: user['id'] | user,
		me?: Pick<user, 'id'> | null | undefined,
		options?: {
			detail?: D,
			includeSecrets?: boolean,
			userProfile?: user_profile,
		},
	): Promise<IsMeAndIsUserDetailed<ExpectsMe, D>> {
		const opts = {
			detail: false,
			includeSecrets: false,
			...options,
		};

		const user = typeof src === 'object' ? src : await this.prismaService.client.user.findUniqueOrThrow({ where: { id: src } });

		await this.migrate(user);

		const meId = me ? me.id : null;
		const isMe = meId === user.id;
		const iAmModerator = me ? await this.roleService.isModerator({ ...me, isRoot: false }) : false;

		const relation = meId && !isMe && opts.detail ? await this.getRelation(meId, user.id) : null;
		const pins = opts.detail ? await this.prismaService.client.user_note_pining.findMany({
			where: { userId: user.id },
			include: { note: true },
			orderBy: { id: 'desc' },
		}) : [];
		const profile = opts.detail ? (opts.userProfile ?? await this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: user.id } })) : null;

		const followingCount = profile == null ? null :
			(profile.ffVisibility === 'public') || isMe ? user.followingCount :
			(profile.ffVisibility === 'followers') && (relation && relation.isFollowing) ? user.followingCount :
			null;

		const followersCount = profile == null ? null :
			(profile.ffVisibility === 'public') || isMe ? user.followersCount :
			(profile.ffVisibility === 'followers') && (relation && relation.isFollowing) ? user.followersCount :
			null;

		const isModerator = isMe && opts.detail ? this.roleService.isModerator(user) : null;
		const isAdmin = isMe && opts.detail ? this.roleService.isAdministrator(user) : null;

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const getDetail = async () => {
			if (!opts.detail) return {};
			if (profile === null) throw new Error(`opts.detail is true, but profile is null.`);

			const result = await awaitAll({
				movedTo: () =>
					user.movedToUri
						? this.apPersonService.resolvePerson(user.movedToUri).then(user => user.id).catch(() => null)
						: Promise.resolve(null),
				alsoKnownAs: () =>
					user.alsoKnownAs
						? Promise.all(user.alsoKnownAs.split(',').map(uri => this.apPersonService.fetchPerson(uri).then(user => user?.id).catch(() => null)))
							.then(xs => xs.length === 0 ? null : xs.filter((x): x is string => x != null))
						: Promise.resolve(null),
				isSilenced: () =>
					this.roleService.getUserPolicies(user.id).then(r => !r.canPublicNote),
				pinnedNotes: () =>
					this.noteEntityService.packMany(pins.map(pin => pin.note), me, { detail: true }),
				pinnedPage: () =>
					profile.pinnedPageId
						? this.pageEntityService.pack(profile.pinnedPageId, me)
						: Promise.resolve(null),
				securityKeys: () =>
					profile.twoFactorEnabled
						? this.prismaService.client.user_security_key.count({ where: { userId: user.id }, take: 1 }).then(result => result > 0)
						: Promise.resolve(false),
				roles: () =>
					this.roleService.getUserRoles(user.id).then(roles =>
						roles
							.filter(role => role.isPublic)
							.sort((a, b) => b.displayOrder - a.displayOrder)
							.map(role => ({
								id: role.id,
								name: role.name,
								color: role.color,
								iconUrl: role.iconUrl,
								description: role.description,
								isModerator: role.isModerator,
								isAdministrator: role.isAdministrator,
								displayOrder: role.displayOrder,
							})),
					),
				memos: () =>
					meId == null
						? Promise.resolve(null)
						: this.prismaService.client.user_memo.findUnique({ where: { userId_targetUserId: { userId: meId, targetUserId: user.id } } }).then(row => row?.memo ?? null),
			});

			return {
				...pick(user, [
					'bannerBlurhash',
					'bannerUrl',
					'isLocked',
					'isSuspended',
					'notesCount',
					'uri'
				]),

				...pick(profile, [
					'birthday',
					'description',
					'ffVisibility',
					'fields',
					'lang',
					'location',
					'pinnedPageId',
					'publicReactions',
					'twoFactorEnabled',
					'url',
					'usePasswordLessLogin',
				]),

				alsoKnownAs: result.alsoKnownAs,
				isSilenced: result.isSilenced,
				memo: result.memos,
				movedTo: result.movedTo,
				pinnedNotes: result.pinnedNotes,
				pinnedPage: result.pinnedPage,
				roles: result.roles,
				securityKeys: result.securityKeys,

				createdAt: user.createdAt.toISOString(),
				followersCount: followersCount ?? 0,
				followingCount: followingCount ?? 0,
				lastFetchedAt: user.lastFetchedAt ? user.lastFetchedAt.toISOString() : null,
				moderationNote: iAmModerator ? profile.moderationNote : undefined,
				pinnedNoteIds: pins.map(pin => pin.noteId),
				updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
			};
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const getDetailMe = async () => {
			if (!opts.detail) return {};
			if (profile === null) throw new Error(`opts.detail is true, but profile is null.`);
			if (!isMe) return {};

			const result = await awaitAll({
				isModerator: () => Promise.resolve(isModerator),
				isAdmin: () => Promise.resolve(isAdmin),
				hasUnreadSpecifiedNotes: () =>
					this.prismaService.client.note_unread.count({ where: { userId: user.id, isSpecified: true }, take: 1 }).then(count => count > 0),
				hasUnreadMentions: () =>
					this.prismaService.client.note_unread.count({ where: { userId: user.id, isMentioned: true }, take: 1 }).then(count => count > 0),
				hasUnreadAnnouncement: () =>
					this.getHasUnreadAnnouncement(user.id),
				hasUnreadAntenna: () =>
					this.getHasUnreadAntenna(user.id),
				hasUnreadNotification: () =>
					this.getHasUnreadNotification(user.id),
				hasPendingReceivedFollowRequest: () =>
					this.getHasPendingReceivedFollowRequest(user.id),
				policies: () =>
					this.roleService.getUserPolicies(user.id),
			});

			return {
				...pick(user, [
					'avatarId',
					'bannerId',
					'hideOnlineStatus',
					'isDeleted',
					'isExplorable',
				]),

				...pick(profile, [
					'achievements',
					'alwaysMarkNsfw',
					'autoAcceptFollowed',
					'autoSensitive',
					'carefulBot',
					'emailNotificationTypes',
					'injectFeaturedNote',
					'mutedInstances',
					'mutedWords',
					'mutingNotificationTypes',
					'noCrawle',
					'preventAiLearning',
					'receiveAnnouncementEmail',
				]),

				hasPendingReceivedFollowRequest: result.hasPendingReceivedFollowRequest,
				hasUnreadAnnouncement: result.hasUnreadAnnouncement,
				hasUnreadAntenna: result.hasUnreadAntenna,
				hasUnreadMentions: result.hasUnreadMentions,
				hasUnreadNotification: result.hasUnreadNotification,
				hasUnreadSpecifiedNotes: result.hasUnreadSpecifiedNotes,
				isAdmin: result.isAdmin,
				isModerator: result.isModerator,
				policies: result.policies,

				loggedInDays: profile.loggedInDates.length,
				hasUnreadChannel: false, // 後方互換性のため
			};
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const getSecrets = async () => {
			if (!opts.includeSecrets) return {};
			if (profile === null) throw new Error(`opts.includeSecrets is true, but profile is null.`);

			return {
				email: profile.email,
				emailVerified: profile.emailVerified,
				securityKeysList: profile.twoFactorEnabled
					? await this.prismaService.client.user_security_key.findMany({
						where: { userId: user.id },
						select: { id: true, name: true, lastUsed: true },
					})
					: [],
			};
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		const getRelation = async () => {
			if (!relation) return {};

			return pick(relation, [
				'hasPendingFollowRequestFromYou',
				'hasPendingFollowRequestToYou',
				'isBlocked',
				'isBlocking',
				'isFollowed',
				'isFollowing',
				'isMuted',
				'isRenoteMuted',
			]);
		};

		const result = await awaitAll({
			instance: () =>
				user.host
					? this.federatedInstanceService.federatedInstanceCache.fetch(user.host).then(instance =>
						instance
							? {
								name: instance.name,
								softwareName: instance.softwareName,
								softwareVersion: instance.softwareVersion,
								iconUrl: instance.iconUrl,
								faviconUrl: instance.faviconUrl,
								themeColor: instance.themeColor,
							}
							: undefined)
					: Promise.resolve(undefined),
			badgeRoles: () =>
				user.host == null // パフォーマンス上の理由でローカルユーザーのみ
					? this.roleService.getUserBadgeRoles(user.id).then(rs => rs.sort((a, b) => b.displayOrder - a.displayOrder).map(r => ({
						name: r.name,
						iconUrl: r.iconUrl,
						displayOrder: r.displayOrder,
					})))
					: Promise.resolve(undefined),
			emojis: () =>
				this.customEmojiService.populateEmojis(user.emojis, user.host),
			detail: getDetail,
			detailMe: getDetailMe,
			secrets: getSecrets,
			relation: getRelation,
		});

		const packed = {
			id: user.id,
			name: user.name,
			username: user.username,
			host: user.host,
			avatarBlurhash: user.avatarBlurhash,
			isBot: user.isBot,
			isCat: user.isCat,

			instance: result.instance,
			emojis: result.emojis,

			avatarUrl: user.avatarUrl ?? this.getIdenticonUrl(user),
			onlineStatus: this.getOnlineStatus(user),
			badgeRoles: result.badgeRoles,

			...result.detail,
			...result.detailMe,
			...result.secrets,
			...result.relation,
		} as z.infer<typeof UserSchema> as IsMeAndIsUserDetailed<ExpectsMe, D>;

		return packed;
	}
}
