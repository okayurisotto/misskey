import { Injectable } from '@nestjs/common';
import type { RemoteUser } from '@/models/entities/User.js';
import { truncate } from '@/misc/truncate.js';
import { CacheService } from '@/core/CacheService.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import { IdService } from '@/core/IdService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { FetchInstanceMetadataService } from '@/core/FetchInstanceMetadataService.js';
import UsersChart from '@/core/chart/charts/users.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import { HashtagService } from '@/core/HashtagService.js';
import { StatusError } from '@/misc/status-error.js';
import { MetaService } from '@/core/MetaService.js';
import { checkHttps } from '@/misc/check-https.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { getApId, getApType, getOneApHrefNullable } from '../type.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApMfmService } from '../ApMfmService.js';
import { ApResolverService, type Resolver } from '../ApResolverService.js';
import { extractApHashtags } from './tag.js';
import { ApPersonAvatarAndBannerResolveService } from './ApPersonAvatarAndBannerResolveService.js';
import { ApPersonAttachmentsAnalyzeService } from './ApPersonAttachmentsAnalyzeService.js';
import { ApPersonFeaturedUpdateService } from './ApPersonFeaturedUpdateService.js';
import { ApHostPunycodeService } from './ApHostPunycodeService.js';
import { ApActorValidateService } from './ApActorValidateService.js';
import { ApNoteEmojiExtractService } from './ApNoteEmojiExtractService.js';

const nameLength = 128;
const summaryLength = 2048;

@Injectable()
export class ApPersonCreateService {
	private readonly logger;

	constructor(
		private readonly apActorValidateService: ApActorValidateService,
		private readonly apHostPunycodeService: ApHostPunycodeService,
		private readonly apLoggerService: ApLoggerService,
		private readonly apMfmService: ApMfmService,
		private readonly apNoteEmojiExtractService: ApNoteEmojiExtractService,
		private readonly apPersonAttachmentsAnalyzeService: ApPersonAttachmentsAnalyzeService,
		private readonly apPersonAvatarAndBannerResolveService: ApPersonAvatarAndBannerResolveService,
		private readonly apPersonFeaturedUpdateService: ApPersonFeaturedUpdateService,
		private readonly apResolverService: ApResolverService,
		private readonly cacheService: CacheService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly fetchInstanceMetadataService: FetchInstanceMetadataService,
		private readonly hashtagService: HashtagService,
		private readonly idService: IdService,
		private readonly instanceChart: InstanceChart,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
		private readonly usersChart: UsersChart,
	) {
		this.logger = this.apLoggerService.logger;
	}

	/**
	 * Personを作成します。
	 */
	public async create(uri: string, resolver?: Resolver): Promise<RemoteUser> {
		if (typeof uri !== 'string') throw new Error('uri is not string');

		if (uri.startsWith(this.configLoaderService.data.url)) {
			throw new StatusError(
				'cannot resolve local user',
				400,
				'cannot resolve local user',
			);
		}

		// eslint-disable-next-line no-param-reassign
		if (resolver == null) resolver = this.apResolverService.createResolver();

		const object = await resolver.resolve(uri);
		if (object.id == null) throw new Error('invalid object.id: ' + object.id);

		const person = this.apActorValidateService.validate(object, uri);

		this.logger.info(`Creating the Person: ${person.id}`);

		const host = this.apHostPunycodeService.punyHost(object.id);

		const fields = this.apPersonAttachmentsAnalyzeService.analyze(
			person.attachment ?? [],
		);

		const tags = extractApHashtags(person.tag)
			.map(normalizeForSearch)
			.splice(0, 32);

		const isBot = getApType(object) === 'Service';

		const bday = person['vcard:bday']?.match(/^\d{4}-\d{2}-\d{2}/);

		const url = getOneApHrefNullable(person.url);

		if (url && !checkHttps(url)) {
			throw new Error('unexpected schema of person url: ' + url);
		}

		// Create user
		let user: RemoteUser | null = null;

		//#region カスタム絵文字取得
		const emojis = await this.apNoteEmojiExtractService
			.extractEmojis(person.tag ?? [], host)
			.then((_emojis) => _emojis.map((emoji) => emoji.name))
			.catch((err) => {
				this.logger.error(`error occured while fetching user emojis`, {
					stack: err,
				});
				return [];
			});
		//#endregion

		try {
			user = await this.prismaService.client.user.create({
				data: {
					id: this.idService.genId(),
					avatarId: null,
					bannerId: null,
					createdAt: new Date(),
					lastFetchedAt: new Date(),
					name: truncate(person.name, nameLength),
					isLocked: person.manuallyApprovesFollowers,
					movedToUri: person.movedTo,
					movedAt: person.movedTo ? new Date() : null,
					alsoKnownAs: person.alsoKnownAs?.join(','),
					isExplorable: person.discoverable,
					username: person.preferredUsername,
					usernameLower: person.preferredUsername.toLowerCase(),
					host,
					inbox: person.inbox,
					sharedInbox: person.sharedInbox ?? person.endpoints?.sharedInbox,
					followersUri: person.followers
						? getApId(person.followers)
						: undefined,
					featured: person.featured ? getApId(person.featured) : undefined,
					uri: person.id,
					tags,
					isBot,
					isCat: person.isCat === true,
					emojis,

					user_profile: {
						create: {
							description: person.summary
								? this.apMfmService.htmlToMfm(
										truncate(person.summary, summaryLength),
										person.tag,
								  )
								: null,
							url,
							fields,
							birthday: bday?.[0] ?? null,
							location: person['vcard:Address'] ?? null,
							userHost: host,
						},
					},

					...(person.publicKey
						? {
								user_publickey: {
									keyId: person.publicKey.id,
									keyPem: person.publicKey.publicKeyPem,
								},
						  }
						: {}),
				},
			});
		} catch (e) {
			// duplicate key error
			if (isDuplicateKeyValueError(e)) {
				// /users/@a => /users/:id のように入力がaliasなときにエラーになることがあるのを対応
				const u = await this.prismaService.client.user.findFirst({
					where: { uri: person.id },
				});
				if (u == null) throw new Error('already registered');

				user = u as RemoteUser;
			} else {
				if (e instanceof Error) {
					this.logger.error(e);
				} else if (typeof e === 'string') {
					this.logger.error(new Error(e));
				}
				throw e;
			}
		}

		if (user == null) throw new Error('failed to create user: user is null');
		// Register to the cache
		this.cacheService.uriPersonCache.set(user.uri, user);

		// Register host
		this.federatedInstanceService.fetch(host).then(async (i) => {
			this.prismaService.client.instance.update({
				where: { id: i.id },
				data: { usersCount: { increment: 1 } },
			});
			this.fetchInstanceMetadataService.fetchInstanceMetadata(i);
			if ((await this.metaService.fetch()).enableChartsForFederatedInstances) {
				this.instanceChart.newUser(i.host);
			}
		});

		this.usersChart.update(user, true);

		// ハッシュタグ更新
		this.hashtagService.updateUsertags(user, tags);

		//#region アバターとヘッダー画像をフェッチ
		try {
			const updates = await this.apPersonAvatarAndBannerResolveService.resolve(
				user,
				person.icon,
				person.image,
			);
			await this.prismaService.client.user.update({
				where: { id: user.id },
				data: updates,
			});
			user = { ...user, ...updates };

			// Register to the cache
			this.cacheService.uriPersonCache.set(user.uri, user);
		} catch (err) {
			this.logger.error('error occured while fetching user avatar/banner', {
				stack: err,
			});
		}
		//#endregion

		await this.apPersonFeaturedUpdateService
			.update(user.id, resolver)
			.catch((err) => {
				if (err instanceof Error || typeof err === 'string') {
					return this.logger.error(err);
				}
			});

		return user;
	}
}
