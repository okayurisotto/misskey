import { z } from 'zod';
import RE2 from 're2';
import * as mfm from 'mfm-js';
import { Inject, Injectable } from '@nestjs/common';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import * as Acct from '@/misc/acct.js';
import type {
	UsersRepository,
	DriveFilesRepository,
	UserProfilesRepository,
	PagesRepository,
} from '@/models/index.js';
import type { User } from '@/models/entities/User.js';
import type { UserProfile } from '@/models/entities/UserProfile.js';
import { notificationTypes } from '@/types.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { langmap } from '@/misc/langmap.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { AccountUpdateService } from '@/core/AccountUpdateService.js';
import { HashtagService } from '@/core/HashtagService.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { CacheService } from '@/core/CacheService.js';
import { AccountMoveService } from '@/core/AccountMoveService.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import {
	BirthdaySchema,
	DescriptionSchema,
	LocationSchema,
	NameSchema,
	misskeyIdPattern,
	uniqueItems,
} from '@/models/zod/misc.js';
import { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import { ApiLoggerService } from '../../ApiLoggerService.js';
import { ApiError } from '../../error.js';

const res = MeDetailedSchema;
export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:account',
	errors: {
		noSuchAvatar: {
			message: 'No such avatar file.',
			code: 'NO_SUCH_AVATAR',
			id: '539f3a45-f215-4f81-a9a8-31293640207f',
		},
		noSuchBanner: {
			message: 'No such banner file.',
			code: 'NO_SUCH_BANNER',
			id: '0d8f5629-f210-41c2-9433-735831a58595',
		},
		avatarNotAnImage: {
			message: 'The file specified as an avatar is not an image.',
			code: 'AVATAR_NOT_AN_IMAGE',
			id: 'f419f9f8-2f4d-46b1-9fb4-49d3a2fd7191',
		},
		bannerNotAnImage: {
			message: 'The file specified as a banner is not an image.',
			code: 'BANNER_NOT_AN_IMAGE',
			id: '75aedb19-2afd-4e6d-87fc-67941256fa60',
		},
		noSuchPage: {
			message: 'No such page.',
			code: 'NO_SUCH_PAGE',
			id: '8e01b590-7eb9-431b-a239-860e086c408e',
		},
		invalidRegexp: {
			message: 'Invalid Regular Expression.',
			code: 'INVALID_REGEXP',
			id: '0d786918-10df-41cd-8f33-8dec7d9a89a5',
		},
		tooManyMutedWords: {
			message: 'Too many muted words.',
			code: 'TOO_MANY_MUTED_WORDS',
			id: '010665b1-a211-42d2-bc64-8f6609d79785',
		},
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'fcd2eef9-a9b2-4c4f-8624-038099e90aa5',
		},
		uriNull: {
			message: 'User ActivityPup URI is null.',
			code: 'URI_NULL',
			id: 'bf326f31-d430-4f97-9933-5d61e4d48a23',
		},
		forbiddenToSetYourself: {
			message: "You can't set yourself as your own alias.",
			code: 'FORBIDDEN_TO_SET_YOURSELF',
			id: '25c90186-4ab0-49c8-9bba-a1fa6c202ba4',
		},
		restrictedByRole: {
			message: 'This feature is restricted by your role.',
			code: 'RESTRICTED_BY_ROLE',
			id: '8feff0ba-5ab5-585b-31f4-4df816663fad',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	name: NameSchema.nullable().optional(),
	description: DescriptionSchema.nullable().optional(),
	location: LocationSchema.nullable().optional(),
	birthday: BirthdaySchema.nullable().optional(),
	lang: z
		.enum([...Object.keys(langmap)])
		.nullable()
		.optional(),
	avatarId: misskeyIdPattern.nullable().optional(),
	bannerId: misskeyIdPattern.nullable().optional(),
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
	pinnedPageId: misskeyIdPattern.nullable().optional(),
	mutedWords: z.array(z.unknown()).optional(),
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
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.pagesRepository)
		private pagesRepository: PagesRepository,

		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private globalEventService: GlobalEventService,
		private userFollowingService: UserFollowingService,
		private accountUpdateService: AccountUpdateService,
		private accountMoveService: AccountMoveService,
		private remoteUserResolveService: RemoteUserResolveService,
		private apiLoggerService: ApiLoggerService,
		private hashtagService: HashtagService,
		private roleService: RoleService,
		private cacheService: CacheService,
	) {
		super(meta, paramDef, async (ps, _user, token) => {
			const user = await this.usersRepository.findOneByOrFail({ id: _user.id });
			const isSecure = token == null;

			const updates = {} as Partial<User>;
			const profileUpdates = {} as Partial<UserProfile>;

			const profile = await this.userProfilesRepository.findOneByOrFail({
				userId: user.id,
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
					.filter((x) => !Array.isArray(x))
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
				profileUpdates.mutingNotificationTypes =
					ps.mutingNotificationTypes as (typeof notificationTypes)[number][];
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
				const avatar = await this.driveFilesRepository.findOneBy({
					id: ps.avatarId,
				});

				if (avatar == null || avatar.userId !== user.id) {
					throw new ApiError(meta.errors.noSuchAvatar);
				}
				if (!avatar.type.startsWith('image/')) {
					throw new ApiError(meta.errors.avatarNotAnImage);
				}

				updates.avatarId = avatar.id;
				updates.avatarUrl = this.driveFileEntityService.getPublicUrl(
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
				const banner = await this.driveFilesRepository.findOneBy({
					id: ps.bannerId,
				});

				if (banner == null || banner.userId !== user.id) {
					throw new ApiError(meta.errors.noSuchBanner);
				}
				if (!banner.type.startsWith('image/')) {
					throw new ApiError(meta.errors.bannerNotAnImage);
				}

				updates.bannerId = banner.id;
				updates.bannerUrl = this.driveFileEntityService.getPublicUrl(banner);
				updates.bannerBlurhash = banner.blurhash;
			} else if (ps.bannerId === null) {
				updates.bannerId = null;
				updates.bannerUrl = null;
				updates.bannerBlurhash = null;
			}

			if (ps.pinnedPageId) {
				const page = await this.pagesRepository.findOneBy({
					id: ps.pinnedPageId,
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

					const toUrl = this.userEntityService.getUserUri(knownAs);
					if (!toUrl) throw new ApiError(meta.errors.uriNull);

					newAlsoKnownAs.add(toUrl);
				}

				updates.alsoKnownAs =
					newAlsoKnownAs.size > 0 ? Array.from(newAlsoKnownAs) : null;
			}

			//#region emojis/tags

			let emojis = [] as string[];
			let tags = [] as string[];

			const newName = updates.name === undefined ? user.name : updates.name;
			const newDescription =
				profileUpdates.description === undefined
					? profile.description
					: profileUpdates.description;

			if (newName != null) {
				const tokens = mfm.parseSimple(newName);
				emojis = emojis.concat(extractCustomEmojisFromMfm(tokens!));
			}

			if (newDescription != null) {
				const tokens = mfm.parse(newDescription);
				emojis = emojis.concat(extractCustomEmojisFromMfm(tokens!));
				tags = extractHashtags(tokens!)
					.map((tag) => normalizeForSearch(tag))
					.splice(0, 32);
			}

			updates.emojis = emojis;
			updates.tags = tags;

			// ハッシュタグ更新
			this.hashtagService.updateUsertags(user, tags);
			//#endregion

			if (Object.keys(updates).length > 0) {
				await this.usersRepository.update(user.id, updates);
			}
			if (Object.keys(updates).includes('alsoKnownAs')) {
				this.cacheService.uriPersonCache.set(
					this.userEntityService.genLocalUserUri(user.id),
					{ ...user, ...updates },
				);
			}
			if (Object.keys(profileUpdates).length > 0) {
				await this.userProfilesRepository.update(user.id, profileUpdates);
			}

			const iObj = await this.userEntityService.pack<true, true>(
				user.id,
				user,
				{
					detail: true,
					includeSecrets: isSecure,
				},
			);

			const updatedProfile = await this.userProfilesRepository.findOneByOrFail({
				userId: user.id,
			});

			this.cacheService.userProfileCache.set(user.id, updatedProfile);

			// Publish meUpdated event
			this.globalEventService.publishMainStream(user.id, 'meUpdated', iObj);

			// 鍵垢を解除したとき、溜まっていたフォローリクエストがあるならすべて承認
			if (user.isLocked && ps.isLocked === false) {
				this.userFollowingService.acceptAllFollowRequests(user);
			}

			// フォロワーにUpdateを配信
			this.accountUpdateService.publishToFollowers(user.id);

			return iObj satisfies z.infer<typeof res>;
		});
	}
}
