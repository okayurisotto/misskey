import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { ModuleRef } from '@nestjs/core';
import { pick } from 'omick';
import { z } from 'zod';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { USER_ACTIVE_THRESHOLD, USER_ONLINE_THRESHOLD } from '@/const.js';
import { type LocalUser, type PartialLocalUser, type PartialRemoteUser, type RemoteUser } from '@/models/entities/User.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import type { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import type { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { MeDetailedOnlySchema } from '@/models/zod/MeDetailedOnlySchema.js';
import type { UserRelationSchema } from '@/models/zod/UserRelationSchema.js';
import type { UserDetailedNotMeOnlySchema } from '@/models/zod/UserDetailedNotMeOnlySchema.js';
import { UserFieldsSchema } from '@/models/zod/UserFieldsSchema.js';
import type { UserSecretsSchema } from '@/models/zod/UserSecretsSchema.js';
import { AchievementSchema } from '@/models/zod/AchievementSchema.js';
import type { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import { InstanceEntityService } from './InstanceEntityService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { CustomEmojiService } from '../CustomEmojiService.js';
import type { NoteEntityService } from './NoteEntityService.js';
import type { DriveFileEntityService } from './DriveFileEntityService.js';
import type { PageEntityService } from './PageEntityService.js';
import type { follow_request, instance, note, note_unread, user, user_memo, user_note_pining, user_profile, user_security_key } from '@prisma/client';

function isLocalUser(user: user): user is LocalUser;
function isLocalUser<T extends { host: user['host'] }>(user: T): user is (T & { host: null; });
function isLocalUser(user: user | { host: user['host'] }): boolean {
	return user.host === null;
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

	public onModuleInit(): void {
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
	 * @param meId
	 * @param targetId
	 * @returns
	 */
	@bindThis
	public async getRelation(
		meId: user['id'],
		targetId: user['id'],
	): Promise<z.infer<typeof UserRelationSchema> & { id: string }> {
		const [me, isRenoteMuted] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: meId },
				include: {
					blocking_blocking_blockeeIdTouser: { where: { blockerId: targetId }, take: 1 },
					blocking_blocking_blockerIdTouser: { where: { blockeeId: targetId }, take: 1 },
					follow_request_follow_request_followeeIdTouser: { where: { followerId: targetId }, take: 1 },
					follow_request_follow_request_followerIdTouser: { where: { followeeId: targetId }, take: 1 },
					following_following_followeeIdTouser: { where: { followerId: targetId }, take: 1 },
					following_following_followerIdTouser: { where: { followeeId: targetId }, take: 1 },
					// muting_muting_muteeIdTouser: { where: { muterId: targetId }, take: 1 },
					muting_muting_muterIdTouser: { where: { muteeId: targetId }, take: 1 },
				},
			}),
			this.prismaService.client.renote_muting.count({
				where: { muterId: meId, muteeId: targetId },
				take: 1,
			}).then(n => n !== 0),
		]);

		return {
			id: targetId,
			hasPendingFollowRequestFromYou: me.follow_request_follow_request_followerIdTouser.length !== 0,
			hasPendingFollowRequestToYou: me.follow_request_follow_request_followeeIdTouser.length !== 0,
			isBlocked: me.blocking_blocking_blockeeIdTouser.length !== 0,
			isBlocking: me.blocking_blocking_blockerIdTouser.length !== 0,
			isFollowed: me.following_following_followeeIdTouser.length !== 0,
			isFollowing: me.following_following_followerIdTouser.length !== 0,
			isMuted: me.muting_muting_muterIdTouser.length !== 0,
			isRenoteMuted: isRenoteMuted,
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
		const count = await this.prismaService.client.announcement.count({
			where: { announcement_read: { none: { userId: userId } } },
			take: 1,
		});

		return count !== 0;
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

		if (latestNotificationId === undefined) return false;
		if (latestReadNotificationId === null) return true;
		if (latestReadNotificationId < latestNotificationId) return true;
		return false;
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
		if (this.isRemoteUser(user)) return user.uri;
		return this.genLocalUserUri(user.id);
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

	/**
	 * `user`に`{avatar,banner}Id`があるのに`{avatar,banner}{Url,Blurhash}`がなかった場合に付け加える。
	 */
	private async migrate(user: user): Promise<void> {
		if (user.avatarId !== null && user.avatarUrl === null) {
			const avatar = await this.prismaService.client.drive_file.findUniqueOrThrow({ where: { id: user.avatarId } });
			const avatarUrl = this.driveFileEntityService.getPublicUrl(avatar, 'avatar');
			await this.prismaService.client.user.update({
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
			await this.prismaService.client.user.update({
				where: { id: user.id },
				data: {
					bannerUrl: bannerUrl,
					bannerBlurhash: banner.blurhash,
				},
			});
		}
	}

	public async getInstance(user: user): Promise<instance | undefined> {
		if (user.host === null) return undefined;

		const instance = await this.federatedInstanceService.federatedInstanceCache.fetch(user.host);
		if (instance === null) return undefined;

		return instance;
	}

	private async packDetailsOnly(
		userId: user['id'],
		meId: user['id'] | null,
		data: {
			user: user[];
			user_profile: user_profile[];
			user_note_pining: user_note_pining[];
			user_security_key: user_security_key[];
			user_memo: user_memo[];
			note: note[];
		},
	): Promise<z.infer<typeof UserDetailedNotMeOnlySchema>> {
		const user = data.user.find((user) => user.id === userId);
		if (user === undefined) throw new Error('user is undefined');

		const profile = data.user_profile.find((profile) => profile.userId === userId);
		if (profile === undefined) throw new Error('profile is undefined');

		const isMe = meId !== null && userId === meId;
		const memos = meId !== null ? data.user_memo.filter((memo) => memo.targetUserId === userId && memo.userId === meId) : null;
		const piningNotes = data.user_note_pining.filter((pin) => pin.userId === userId);
		const securityKeys = data.user_security_key.filter((key) => key.userId === userId);

		const result = await awaitAll({
			iAmModerator: () =>
				meId !== null
					? this.roleService.isModerator({ id: meId, isRoot: false })
					: Promise.resolve(false),
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
				this.noteEntityService.packMany(piningNotes.map((pin) => {
					const note = data.note.find((note) => note.id === pin.noteId);
					if (note === undefined) throw new Error('note is undefined');
					return note;
				})),
			pinnedPage: () =>
				profile.pinnedPageId
					? this.pageEntityService.pack(profile.pinnedPageId, user)
					: Promise.resolve(null),
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
			relation: async () => meId ? await this.getRelation(meId, userId) : undefined,
		});

		const followersCount = (profile.ffVisibility === 'public') || isMe
			? user.followersCount
			: (profile.ffVisibility === 'followers') && (result.relation !== undefined && result.relation.isFollowing)
				? user.followersCount
				: 0;

		const followingCount = (profile.ffVisibility === 'public') || isMe
			? user.followingCount
			: (profile.ffVisibility === 'followers') && (result.relation !== undefined && result.relation.isFollowing)
				? user.followingCount
				: 0;

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
				'lang',
				'location',
				'pinnedPageId',
				'publicReactions',
				'twoFactorEnabled',
				'url',
				'usePasswordLessLogin',
			]),

			createdAt: user.createdAt.toISOString(),
			fields: UserFieldsSchema.parse(profile.fields),
			followersCount: followersCount,
			followingCount: followingCount,
			lastFetchedAt: user.lastFetchedAt ? user.lastFetchedAt.toISOString() : null,
			memo: memos?.at(0)?.memo ?? null,
			pinnedNoteIds: piningNotes.map(pin => pin.noteId),
			securityKeys: securityKeys.length > 0,
			updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,

			alsoKnownAs: result.alsoKnownAs,
			isSilenced: result.isSilenced,
			moderationNote: result.iAmModerator ? profile.moderationNote : undefined,
			movedTo: result.movedTo,
			pinnedNotes: result.pinnedNotes,
			pinnedPage: result.pinnedPage,
			roles: result.roles,
		};
	};

	private async packDetailsMeOnly(
		userId: string,
		data: {
			user: user[];
			user_profile: user_profile[];
			nore_unread: note_unread[];
			follow_request: follow_request[];
		},
	): Promise<z.infer<typeof MeDetailedOnlySchema>> {
		const user = data.user.find((user) => user.id === userId);
		if (user === undefined) throw new Error();

		const profile = data.user_profile.find((profile) => profile.userId === userId);
		if (profile === undefined) throw new Error();

		const hasUnreadMentions = data.nore_unread.some((unread) => unread.userId === userId && unread.isMentioned);
		const hasUnreadSpecifiedNotes = data.nore_unread.some((unread) => unread.userId === userId && unread.isSpecified);
		const hasPendingReceivedFollowRequest = data.follow_request.some((request) => request.followeeId === userId);

		type AwaitKeys =
			| 'hasUnreadAnnouncement'
			| 'hasUnreadNotification'
			| 'isAdmin'
			| 'isModerator'
			| 'policies';

		const result = await awaitAll<Pick<z.infer<typeof MeDetailedOnlySchema>, AwaitKeys>>({
			hasUnreadAnnouncement: () => this.getHasUnreadAnnouncement(userId),
			hasUnreadNotification: () => this.getHasUnreadNotification(userId),
			isAdmin: () => this.roleService.isAdministrator(user),
			isModerator: () => this.roleService.isModerator(user),
			policies: () => this.roleService.getUserPolicies(userId),
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
				'alwaysMarkNsfw',
				'autoAcceptFollowed',
				'autoSensitive',
				'carefulBot',
				'injectFeaturedNote',
				'mutingNotificationTypes',
				'noCrawle',
				'preventAiLearning',
				'receiveAnnouncementEmail',
			]),

			hasUnreadMentions,
			hasUnreadSpecifiedNotes,
			hasPendingReceivedFollowRequest,

			hasUnreadAnnouncement: result.hasUnreadAnnouncement,
			hasUnreadAntenna: false,
			hasUnreadNotification: result.hasUnreadNotification,
			isAdmin: result.isAdmin,
			isModerator: result.isModerator,
			policies: result.policies,

			achievements: z.array(AchievementSchema).parse(profile.achievements),
			emailNotificationTypes: z.array(z.string()).nullable().parse(profile.emailNotificationTypes),
			hasUnreadChannel: false as const, // 後方互換性のため
			loggedInDays: profile.loggedInDates.length,
			mutedInstances: z.array(z.string()).nullable().parse(profile.mutedInstances),
			mutedWords: z.array(z.array(z.string())).parse(profile.mutedWords),
		};
	};

	private async packSecretsOnly(
		userId: string,
		data: {
			user_profile: user_profile[],
			user_security_key: user_security_key[],
		},
	): Promise<z.infer<typeof UserSecretsSchema>> {
		const profile = data.user_profile.find((profile) => profile.userId === userId);
		if (profile === undefined) throw new Error('profile is undefined');

		const keys = data.user_security_key.filter((key) => key.userId === userId);

		return {
			email: profile.email,
			emailVerified: profile.emailVerified,
			securityKeysList: profile.twoFactorEnabled ? keys : [],
		};
	};

	public async packLite(user: user): Promise<z.infer<typeof UserLiteSchema>> {
		await this.migrate(user);

		const [instance, badgeRoles, emojis] = await Promise.all([
			this.getInstance(user),
			user.host === null // パフォーマンス上の理由でローカルユーザーのみ
				? this.roleService.getUserBadgeRoles(user.id).then(roles => roles
						.sort((a, b) => b.displayOrder - a.displayOrder)
						.map(role => pick(role, ['name', 'iconUrl', 'displayOrder']))
					)
				: Promise.resolve(undefined),
			this.customEmojiService.populateEmojis(user.emojis, user.host),
		]);

		return {
			...pick(user, ['id', 'name', 'username', 'host', 'avatarBlurhash', 'isBot', 'isCat']),

			badgeRoles,
			emojis,

			avatarUrl: user.avatarUrl ?? this.getIdenticonUrl(user),
			instance: instance !== undefined ? this.instanceEntityService.packLite(instance) : undefined,
			onlineStatus: this.getOnlineStatus(user),
		};
	}

	public async packDetailed(
		src: user['id'] | user,
		me?: Pick<user, 'id'> | null | undefined,
		options?: {
			includeSecrets?: boolean;
		},
	): Promise<z.infer<typeof UserDetailedSchema>> {
		const opts = { includeSecrets: false, ...options };
		const userId = typeof src === 'string' ? src : src.id;
		const meId = me ? me.id : null;
		const isMe = meId === userId;
		const relation = meId && !isMe ? await this.getRelation(meId, userId) : undefined;

		const result = await this.prismaService.client.user.findUniqueOrThrow({
			where: { id: userId },
			include: {
				user_profile: true,
				user_note_pining: { include: { note: true }, orderBy: { id: 'desc' } },
				user_security_key: true,
				user_memo_user_memo_targetUserIdTouser: { where: { targetUserId: userId } },
				note_unread: true,
				follow_request_follow_request_followeeIdTouser: true,
			},
		});
		if (result.user_profile === null) throw new Error('data.user_profile is null');

		const data = {
			follow_request: result.follow_request_follow_request_followeeIdTouser,
			nore_unread: result.note_unread,
			note: result.user_note_pining.map((pin) => pin.note),
			relation,
			user_memo: result.user_memo_user_memo_targetUserIdTouser,
			user_note_pining: result.user_note_pining,
			user_profile: [result.user_profile],
			user_security_key: result.user_security_key,
			user: [result],
		};

		const getRelation = (relation: z.infer<typeof UserRelationSchema>): z.infer<typeof UserRelationSchema> => {
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

		const [packedUserLite, detail, detailMe, secrets] = await Promise.all([
			this.packLite(result),
			this.packDetailsOnly(userId, meId, data),
			isMe ? this.packDetailsMeOnly(userId, data) : {},
			opts.includeSecrets ? this.packSecretsOnly(userId, data) : {},
		]);

		return {
			...packedUserLite,
			...detail,
			...detailMe,
			...secrets,
			...(relation ? getRelation(relation) : {}),
		};
	}

	/**
	 * `MeDetailed`を返すpack系メソッド。
	 * `packDetailed`メソッドでも現時点では事足りるが、そちらは`DetailedNotMe`とのunionが返されてしまうので。
	 */
	public async packDetailedMe(
		src: user['id'] | user,
		options?: {
			includeSecrets?: boolean;
		},
	): Promise<z.infer<typeof MeDetailedSchema>> {
		const userId = typeof src === 'string' ? src : src.id;
		const includeSecrets = options?.includeSecrets ?? false;

		const result = await this.prismaService.client.user.findUniqueOrThrow({
			where: { id: userId },
			include: {
				follow_request_follow_request_followeeIdTouser: true,
				user_profile: true,
				user_note_pining: { include: { note: true }, orderBy: { id: 'desc' } },
				user_security_key: true,
				user_memo_user_memo_targetUserIdTouser: { where: { targetUserId: userId, userId } },
				note_unread: true,
			},
		});
		if (result.user_profile === null) throw new Error('data.user_profile is null');

		const data = {
			follow_request: result.follow_request_follow_request_followeeIdTouser,
			nore_unread: result.note_unread,
			note: result.user_note_pining.map((pin) => pin.note),
			user_memo: result.user_memo_user_memo_targetUserIdTouser,
			user_note_pining: result.user_note_pining,
			user_profile: [result.user_profile],
			user_security_key: result.user_security_key,
			user: [result],
		};

		const [packedUserLite, detail, detailMe, secrets] = await Promise.all([
			this.packLite(result),
			this.packDetailsOnly(result.id, result.id, data),
			this.packDetailsMeOnly(result.id, data),
			this.packSecretsOnly(result.id, data),
		]);

		return {
			...packedUserLite,
			...detail,
			...detailMe,
			...(includeSecrets ? secrets : {}),
		};
	}
}
