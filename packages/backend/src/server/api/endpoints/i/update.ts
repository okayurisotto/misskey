import { z } from 'zod';
import RE2 from 're2';
import * as mfm from 'mfm-js';
import { Injectable } from '@nestjs/common';
import {
	noSuchAvatar,
	noSuchBanner,
	avatarNotAnImage,
	bannerNotAnImage,
	noSuchPage,
	invalidRegexp,
	tooManyMutedWords,
	noSuchUser____________,
	uriNull_,
	forbiddenToSetYourself,
	restrictedByRole_,
} from '@/server/api/errors.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import * as Acct from '@/misc/acct.js';
import { notificationTypes } from '@/types.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { langmap } from '@/misc/langmap.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { AccountUpdateService } from '@/core/AccountUpdateService.js';
import { HashtagService } from '@/core/HashtagService.js';
import { RoleService } from '@/core/RoleService.js';
import { CacheService } from '@/core/CacheService.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import {
	BirthdaySchema,
	DescriptionSchema,
	LocationSchema,
	NameSchema,
	MisskeyIdSchema,
	uniqueItems,
} from '@/models/zod/misc.js';
import { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserFollowRequestAcceptAllService } from '@/core/UserFollowRequestAcceptAllService.js';
import { DriveFilePublicUrlGenerationService } from '@/core/entities/DriveFilePublicUrlGenerationService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import { ApiLoggerService } from '../../ApiLoggerService.js';
import { ApiError } from '../../error.js';
import type { Prisma, user } from '@prisma/client';

const res = MeDetailedSchema;
export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:account',
	errors: {
		noSuchAvatar: noSuchAvatar,
		noSuchBanner: noSuchBanner,
		avatarNotAnImage: avatarNotAnImage,
		bannerNotAnImage: bannerNotAnImage,
		noSuchPage: noSuchPage,
		invalidRegexp: invalidRegexp,
		tooManyMutedWords: tooManyMutedWords,
		noSuchUser: noSuchUser____________,
		uriNull: uriNull_,
		forbiddenToSetYourself: forbiddenToSetYourself,
		restrictedByRole: restrictedByRole_,
	},
	res,
} as const;

type OneOrMore<T extends unknown[]> = [T[number], ...T[number][]];

export const paramDef = z.object({
	name: NameSchema.nullable().optional(),
	description: DescriptionSchema.nullable().optional(),
	location: LocationSchema.nullable().optional(),
	birthday: BirthdaySchema.nullable().optional(),
	lang: z
		.enum(Object.keys(langmap) as OneOrMore<(keyof typeof langmap)[]>)
		.nullable()
		.optional(),
	avatarId: MisskeyIdSchema.nullable().optional(),
	bannerId: MisskeyIdSchema.nullable().optional(),
	fields: z
		.array(
			z.object({
				name: z.string(),
				value: z.string(),
			}),
		)
		.min(0)
		.max(16)
		.optional(),
	isLocked: z.boolean().optional(),
	isExplorable: z.boolean().optional(),
	hideOnlineStatus: z.boolean().optional(),
	publicReactions: z.boolean().optional(),
	carefulBot: z.boolean().optional(),
	autoAcceptFollowed: z.boolean().optional(),
	noCrawle: z.boolean().optional(),
	preventAiLearning: z.boolean().optional(),
	isBot: z.boolean().optional(),
	isCat: z.boolean().optional(),
	injectFeaturedNote: z.boolean().optional(),
	receiveAnnouncementEmail: z.boolean().optional(),
	alwaysMarkNsfw: z.boolean().optional(),
	autoSensitive: z.boolean().optional(),
	ffVisibility: z.enum(['public', 'followers', 'private']).optional(),
	pinnedPageId: MisskeyIdSchema.nullable().optional(),
	mutedWords: z.array(z.union([z.array(z.string()), z.string()])).optional(),
	mutedInstances: z.array(z.string()).optional(),
	mutingNotificationTypes: z.array(z.enum(notificationTypes)).optional(),
	emailNotificationTypes: z.array(z.string()).optional(),
	alsoKnownAs: uniqueItems(z.array(z.string()).max(10)).optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly accountUpdateService: AccountUpdateService,
		private readonly apiLoggerService: ApiLoggerService,
		private readonly cacheService: CacheService,
		private readonly globalEventService: GlobalEventService,
		private readonly hashtagService: HashtagService,
		private readonly prismaService: PrismaService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly roleService: RoleService,
		private readonly userEntityService: UserEntityService,
		private readonly userFollowRequestAcceptAllService: UserFollowRequestAcceptAllService,
		private readonly driveFilePublicUrlGenerationService: DriveFilePublicUrlGenerationService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {
		super(meta, paramDef, async (ps, _user, token) => {
			const user = await this.prismaService.client.user.findUniqueOrThrow({
				where: { id: _user.id },
			});
			const isSecure = token == null;

			const updates: Partial<user> = {};
			const profileUpdates: Prisma.user_profileUncheckedUpdateInput = {};

			const profile =
				await this.prismaService.client.user_profile.findUniqueOrThrow({
					where: { userId: user.id },
				});

			if (ps.name !== undefined) updates.name = ps.name;
			if (ps.description !== undefined) {
				profileUpdates.description = ps.description;
			}
			if (ps.lang !== undefined) profileUpdates.lang = ps.lang;
			if (ps.location !== undefined) profileUpdates.location = ps.location;
			if (ps.birthday !== undefined) profileUpdates.birthday = ps.birthday;
			if (ps.ffVisibility !== undefined) {
				profileUpdates.ffVisibility = ps.ffVisibility;
			}
			if (ps.mutedWords !== undefined) {
				// TODO: ちゃんと数える
				const length = JSON.stringify(ps.mutedWords).length;
				if (
					length >
					(await this.roleService.getUserPolicies(user.id)).wordMuteLimit
				) {
					throw new ApiError(meta.errors.tooManyMutedWords);
				}

				// validate regular expression syntax
				ps.mutedWords
					.filter((x): x is string => !Array.isArray(x))
					.forEach((x) => {
						const regexp = x.match(/^\/(.+)\/(.*)$/);
						if (!regexp) throw new ApiError(meta.errors.invalidRegexp);

						try {
							new RE2(regexp[1], regexp[2]);
						} catch (err) {
							throw new ApiError(meta.errors.invalidRegexp);
						}
					});

				profileUpdates.mutedWords = ps.mutedWords;
				profileUpdates.enableWordMute = ps.mutedWords.length > 0;
			}
			if (ps.mutedInstances !== undefined) {
				profileUpdates.mutedInstances = ps.mutedInstances;
			}
			if (ps.mutingNotificationTypes !== undefined) {
				profileUpdates.mutingNotificationTypes = ps.mutingNotificationTypes;
			}
			if (typeof ps.isLocked === 'boolean') updates.isLocked = ps.isLocked;
			if (typeof ps.isExplorable === 'boolean') {
				updates.isExplorable = ps.isExplorable;
			}
			if (typeof ps.hideOnlineStatus === 'boolean') {
				updates.hideOnlineStatus = ps.hideOnlineStatus;
			}
			if (typeof ps.publicReactions === 'boolean') {
				profileUpdates.publicReactions = ps.publicReactions;
			}
			if (typeof ps.isBot === 'boolean') updates.isBot = ps.isBot;
			if (typeof ps.carefulBot === 'boolean') {
				profileUpdates.carefulBot = ps.carefulBot;
			}
			if (typeof ps.autoAcceptFollowed === 'boolean') {
				profileUpdates.autoAcceptFollowed = ps.autoAcceptFollowed;
			}
			if (typeof ps.noCrawle === 'boolean') {
				profileUpdates.noCrawle = ps.noCrawle;
			}
			if (typeof ps.preventAiLearning === 'boolean') {
				profileUpdates.preventAiLearning = ps.preventAiLearning;
			}
			if (typeof ps.isCat === 'boolean') updates.isCat = ps.isCat;
			if (typeof ps.injectFeaturedNote === 'boolean') {
				profileUpdates.injectFeaturedNote = ps.injectFeaturedNote;
			}
			if (typeof ps.receiveAnnouncementEmail === 'boolean') {
				profileUpdates.receiveAnnouncementEmail = ps.receiveAnnouncementEmail;
			}
			if (typeof ps.alwaysMarkNsfw === 'boolean') {
				if ((await roleService.getUserPolicies(user.id)).alwaysMarkNsfw) {
					throw new ApiError(meta.errors.restrictedByRole);
				}
				profileUpdates.alwaysMarkNsfw = ps.alwaysMarkNsfw;
			}
			if (typeof ps.autoSensitive === 'boolean') {
				profileUpdates.autoSensitive = ps.autoSensitive;
			}
			if (ps.emailNotificationTypes !== undefined) {
				profileUpdates.emailNotificationTypes = ps.emailNotificationTypes;
			}

			if (ps.avatarId) {
				const avatar = await this.prismaService.client.driveFile.findUnique({
					where: { id: ps.avatarId },
				});

				if (avatar == null || avatar.userId !== user.id) {
					throw new ApiError(meta.errors.noSuchAvatar);
				}
				if (!avatar.type.startsWith('image/')) {
					throw new ApiError(meta.errors.avatarNotAnImage);
				}

				updates.avatarId = avatar.id;
				updates.avatarUrl = this.driveFilePublicUrlGenerationService.generate(
					avatar,
					'avatar',
				);
				updates.avatarBlurhash = avatar.blurhash;
			} else if (ps.avatarId === null) {
				updates.avatarId = null;
				updates.avatarUrl = null;
				updates.avatarBlurhash = null;
			}

			if (ps.bannerId) {
				const banner = await this.prismaService.client.driveFile.findUnique({
					where: { id: ps.bannerId },
				});

				if (banner == null || banner.userId !== user.id) {
					throw new ApiError(meta.errors.noSuchBanner);
				}
				if (!banner.type.startsWith('image/')) {
					throw new ApiError(meta.errors.bannerNotAnImage);
				}

				updates.bannerId = banner.id;
				updates.bannerUrl =
					this.driveFilePublicUrlGenerationService.generate(banner);
				updates.bannerBlurhash = banner.blurhash;
			} else if (ps.bannerId === null) {
				updates.bannerId = null;
				updates.bannerUrl = null;
				updates.bannerBlurhash = null;
			}

			if (ps.pinnedPageId) {
				const page = await this.prismaService.client.page.findUnique({
					where: { id: ps.pinnedPageId },
				});

				if (page == null || page.userId !== user.id) {
					throw new ApiError(meta.errors.noSuchPage);
				}

				profileUpdates.pinnedPageId = page.id;
			} else if (ps.pinnedPageId === null) {
				profileUpdates.pinnedPageId = null;
			}

			if (ps.fields) {
				profileUpdates.fields = ps.fields
					.filter(
						(x) =>
							typeof x.name === 'string' &&
							x.name !== '' &&
							typeof x.value === 'string' &&
							x.value !== '',
					)
					.map((x) => {
						return { name: x.name, value: x.value };
					});
			}

			if (ps.alsoKnownAs) {
				if (_user.movedToUri) {
					throw new ApiError({
						message: 'You have moved your account.',
						code: 'YOUR_ACCOUNT_MOVED',
						id: '56f20ec9-fd06-4fa5-841b-edd6d7d4fa31',
						httpStatusCode: 403,
					});
				}

				// Parse user's input into the old account
				const newAlsoKnownAs = new Set<string>();
				for (const line of ps.alsoKnownAs) {
					if (!line) throw new ApiError(meta.errors.noSuchUser);
					const { username, host } = Acct.parse(line);

					// Retrieve the old account
					const knownAs = await this.remoteUserResolveService
						.resolveUser(username, host)
						.catch((e) => {
							this.apiLoggerService.logger.warn(
								`failed to resolve dstination user: ${e}`,
							);
							throw new ApiError(meta.errors.noSuchUser);
						});
					if (knownAs.id === _user.id) {
						throw new ApiError(meta.errors.forbiddenToSetYourself);
					}

					const toUrl = this.userEntityUtilService.getUserUri(knownAs);
					if (!toUrl) throw new ApiError(meta.errors.uriNull);

					newAlsoKnownAs.add(toUrl);
				}

				updates.alsoKnownAs =
					newAlsoKnownAs.size > 0 ? Array.from(newAlsoKnownAs).join(',') : null;
			}

			//#region emojis/tags

			let emojis: string[] = [];
			let tags: string[] = [];

			const newName = updates.name === undefined ? user.name : updates.name;
			const newDescription =
				typeof profileUpdates.description !== 'string'
					? profile.description
					: profileUpdates.description;

			if (newName != null) {
				const tokens = mfm.parseSimple(newName);
				emojis = emojis.concat(extractCustomEmojisFromMfm(tokens));
			}

			if (newDescription != null) {
				const tokens = mfm.parse(newDescription);
				emojis = emojis.concat(extractCustomEmojisFromMfm(tokens));
				tags = extractHashtags(tokens)
					.map((tag) => normalizeForSearch(tag))
					.splice(0, 32);
			}

			updates.emojis = emojis;
			updates.tags = tags;

			// ハッシュタグ更新
			this.hashtagService.updateUsertags(user, tags);
			//#endregion

			if (Object.keys(updates).length > 0) {
				await this.prismaService.client.user.update({
					where: { id: user.id },
					data: updates,
				});
			}
			if (Object.keys(updates).includes('alsoKnownAs')) {
				this.cacheService.uriPersonCache.set(
					this.userEntityUtilService.genLocalUserUri(user.id),
					{ ...user, ...updates },
				);
			}
			if (Object.keys(profileUpdates).length > 0) {
				await this.prismaService.client.user_profile.update({
					where: { userId: user.id },
					data: profileUpdates,
				});
			}

			const iObj = await this.userEntityService.packDetailedMe(user.id, {
				includeSecrets: isSecure,
			});

			const updatedProfile =
				await this.prismaService.client.user_profile.findUniqueOrThrow({
					where: { userId: user.id },
				});

			this.cacheService.userProfileCache.set(user.id, updatedProfile);

			// Publish meUpdated event
			this.globalEventService.publishMainStream(user.id, 'meUpdated', iObj);

			// 鍵垢を解除したとき、溜まっていたフォローリクエストがあるならすべて承認
			if (user.isLocked && ps.isLocked === false) {
				this.userFollowRequestAcceptAllService.acceptAll(user);
			}

			// フォロワーにUpdateを配信
			this.accountUpdateService.publishToFollowers(user.id);

			return iObj;
		});
	}
}
