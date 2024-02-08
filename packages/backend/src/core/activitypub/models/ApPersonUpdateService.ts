import { Injectable } from '@nestjs/common';
import type { RemoteUser } from '@/models/entities/User.js';
import { truncate } from '@/misc/truncate.js';
import { CacheService } from '@/core/CacheService.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import type Logger from '@/misc/logger.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { HashtagService } from '@/core/HashtagService.js';
import { checkHttps } from '@/misc/check-https.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { getApId, getApType, getOneApHrefNullable } from '../type.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApMfmService } from '../ApMfmService.js';
import { ApResolverService, type Resolver } from '../ApResolverService.js';
import { extractApHashtags } from './tag.js';
import { ApPersonFetchService } from './ApPersonFetchService.js';
import { ApPersonAvatarAndBannerResolveService } from './ApPersonAvatarAndBannerResolveService.js';
import { ApPersonAttachmentsAnalyzeService } from './ApPersonAttachmentsAnalyzeService.js';
import { ApPersonFeaturedUpdateService } from './ApPersonFeaturedUpdateService.js';
import { ApActorValidateService } from './ApActorValidateService.js';
import { RemoteAccountMovingService } from './RemoteAccountMovingService.js';
import { ApNoteEmojiExtractService } from './ApNoteEmojiExtractService.js';
import type { IObject } from '../type.js';

const nameLength = 128;
const summaryLength = 2048;

@Injectable()
export class ApPersonUpdateService {
	private readonly logger: Logger;

	constructor(
		private readonly apActorValidateService: ApActorValidateService,
		private readonly apLoggerService: ApLoggerService,
		private readonly apMfmService: ApMfmService,
		private readonly apNoteEmojiExtractService: ApNoteEmojiExtractService,
		private readonly apPersonAttachmentsAnalyzeService: ApPersonAttachmentsAnalyzeService,
		private readonly apPersonAvatarAndBannerResolveService: ApPersonAvatarAndBannerResolveService,
		private readonly apPersonFeaturedUpdateService: ApPersonFeaturedUpdateService,
		private readonly apPersonFetchService: ApPersonFetchService,
		private readonly apResolverService: ApResolverService,
		private readonly cacheService: CacheService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly globalEventService: GlobalEventService,
		private readonly hashtagService: HashtagService,
		private readonly prismaService: PrismaService,
		private readonly remoteAccountMovingService: RemoteAccountMovingService,
	) {
		this.logger = this.apLoggerService.logger;
	}

	/**
	 * Personの情報を更新します。
	 * Misskeyに対象のPersonが登録されていなければ無視します。
	 * もしアカウントの移行が確認された場合、アカウント移行処理を行います。
	 *
	 * @param uri URI of Person
	 * @param resolver Resolver
	 * @param hint Hint of Person object (この値が正当なPersonの場合、Remote resolveをせずに更新に利用します)
	 * @param movePreventUris ここに指定されたURIがPersonのmovedToに指定されていたり10回より多く回っている場合これ以上アカウント移行を行わない（無限ループ防止）
	 */
	public async update(
		uri: string,
		resolver?: Resolver | null,
		hint?: IObject,
		movePreventUris: string[] = [],
	): Promise<string | void> {
		if (typeof uri !== 'string') throw new Error('uri is not string');

		// URIがこのサーバーを指しているならスキップ
		if (uri.startsWith(`${this.configLoaderService.data.url}/`)) return;

		//#region このサーバーに既に登録されているか
		const exist = (await this.apPersonFetchService.fetch(
			uri,
		)) as RemoteUser | null;
		if (exist === null) return;
		//#endregion

		// eslint-disable-next-line no-param-reassign
		if (resolver == null) resolver = this.apResolverService.createResolver();

		const object = hint ?? (await resolver.resolve(uri));

		const person = this.apActorValidateService.validate(object, uri);

		this.logger.info(`Updating the Person: ${person.id}`);

		// カスタム絵文字取得
		const emojis = await this.apNoteEmojiExtractService
			.extractEmojis(person.tag ?? [], exist.host)
			.catch((e) => {
				this.logger.info(`extractEmojis: ${e}`);
				return [];
			});

		const emojiNames = emojis.map((emoji) => emoji.name);

		const fields = this.apPersonAttachmentsAnalyzeService.analyze(
			person.attachment ?? [],
		);

		const tags = extractApHashtags(person.tag)
			.map(normalizeForSearch)
			.splice(0, 32);

		const bday = person['vcard:bday']?.match(/^\d{4}-\d{2}-\d{2}/);

		const url = getOneApHrefNullable(person.url);

		if (url && !checkHttps(url)) {
			throw new Error('unexpected schema of person url: ' + url);
		}

		const updates: Partial<RemoteUser> = {
			lastFetchedAt: new Date(),
			inbox: person.inbox,
			sharedInbox: person.sharedInbox ?? person.endpoints?.sharedInbox,
			followersUri: person.followers ? getApId(person.followers) : undefined,
			featured: person.featured,
			emojis: emojiNames,
			name: truncate(person.name, nameLength),
			tags,
			isBot: getApType(object) === 'Service',
			isCat: person.isCat === true,
			isLocked: person.manuallyApprovesFollowers,
			movedToUri: person.movedTo ?? null,
			alsoKnownAs: person.alsoKnownAs?.join(',') ?? null,
			isExplorable: person.discoverable,
			...(await this.apPersonAvatarAndBannerResolveService
				.resolve(exist, person.icon, person.image)
				.catch(() => ({}))),
		};

		const moving = ((): boolean => {
			// 移行先がない→ある
			if (exist.movedToUri === null && updates.movedToUri) return true;

			// 移行先がある→別のもの
			if (
				exist.movedToUri !== null &&
				updates.movedToUri !== null &&
				exist.movedToUri !== updates.movedToUri
			)
				return true;

			// 移行先がある→ない、ない→ないは無視
			return false;
		})();

		if (moving) updates.movedAt = new Date();

		// Update user
		await this.prismaService.client.user.update({
			where: { id: exist.id },
			data: updates,
		});

		if (person.publicKey) {
			await this.prismaService.client.user_publickey.update({
				where: { userId: exist.id },
				data: {
					keyId: person.publicKey.id,
					keyPem: person.publicKey.publicKeyPem,
				},
			});
		}

		await this.prismaService.client.user_profile.update({
			where: { userId: exist.id },
			data: {
				url,
				fields,
				description: person.summary
					? this.apMfmService.htmlToMfm(
							truncate(person.summary, summaryLength),
							person.tag,
					  )
					: null,
				birthday: bday?.[0] ?? null,
				location: person['vcard:Address'] ?? null,
			},
		});

		this.globalEventService.publishInternalEvent('remoteUserUpdated', {
			id: exist.id,
		});

		// ハッシュタグ更新
		this.hashtagService.updateUsertags(exist, tags);

		await this.apPersonFeaturedUpdateService
			.update(exist.id, resolver)
			.catch((err) => {
				if (err instanceof Error || typeof err === 'string') {
					return this.logger.error(err);
				}
			});

		const updated = { ...exist, ...updates };

		this.cacheService.uriPersonCache.set(uri, updated);

		// 移行処理を行う
		if (
			updated.movedAt &&
			// 初めて移行する場合はmovedAtがnullなので移行処理を許可
			(exist.movedAt == null ||
				// 以前のmovingから14日以上経過した場合のみ移行処理を許可
				// （Mastodonのクールダウン期間は30日だが若干緩めに設定しておく）
				exist.movedAt.getTime() + 1000 * 60 * 60 * 24 * 14 <
					updated.movedAt.getTime())
		) {
			this.logger.info(
				`Start to process Move of @${updated.username}@${updated.host} (${uri})`,
			);
			return await this.remoteAccountMovingService
				.move(updated, movePreventUris)
				.then((result) => {
					this.logger.info(
						`Processing Move Finished [${result}] @${updated.username}@${updated.host} (${uri})`,
					);
					return result;
				})
				.catch((e) => {
					this.logger.info(
						`Processing Move Failed @${updated.username}@${updated.host} (${uri})`,
					);
				});
		}

		return 'skip';
	}
}
