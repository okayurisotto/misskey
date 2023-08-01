import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { IsNull, LessThanOrEqual, MoreThan, Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import JSON5 from 'json5';
import type { AdsRepository, UsersRepository } from '@/models/index.js';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MetaService } from '@/core/MetaService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';

const res = z.object({
	maintainerName: z.string().nullable(),
	maintainerEmail: z.string().nullable(),
	version: z.string(),
	name: z.string(),
	uri: z.string().url(),
	description: z.string().nullable(),
	langs: z.array(z.string()),
	tosUrl: z.string().nullable(),
	repositoryUrl: z.string().default('https://github.com/misskey-dev/misskey'),
	feedbackUrl: z
		.string()
		.default('https://github.com/misskey-dev/misskey/issues/new'),
	defaultDarkTheme: z.string().nullable(),
	defaultLightTheme: z.string().nullable(),
	disableRegistration: z.boolean(),
	cacheRemoteFiles: z.boolean(),
	cacheRemoteSensitiveFiles: z.boolean(),
	emailRequiredForSignup: z.boolean(),
	enableHcaptcha: z.boolean(),
	hcaptchaSiteKey: z.string().nullable(),
	enableRecaptcha: z.boolean(),
	recaptchaSiteKey: z.string().nullable(),
	enableTurnstile: z.boolean(),
	turnstileSiteKey: z.string().nullable(),
	swPublickey: z.string().nullable(),
	mascotImageUrl: z.string().default('/assets/ai.png'),
	bannerUrl: z.string(),
	serverErrorImageUrl: z.string().nullable(),
	infoImageUrl: z.string().nullable(),
	notFoundImageUrl: z.string().nullable(),
	iconUrl: z.string().nullable(),
	maxNoteTextLength: z.number(),
	ads: z.array(
		z.object({
			place: z.string(),
			url: z.string().url(),
			imageUrl: z.string().url(),
		}),
	),
	requireSetup: z.boolean(),
	enableEmail: z.boolean(),
	enableServiceWorker: z.boolean(),
	translatorAvailable: z.boolean(),
	proxyAccountName: z.string().nullable(),
	mediaProxy: z.string(),
	features: z.object({
		registration: z.boolean(),
		localTimeLine: z.boolean(),
		globalTimeLine: z.boolean(),
		hcaptcha: z.boolean(),
		recaptcha: z.boolean(),
		objectStorage: z.boolean(),
		serviceWorker: z.boolean(),
		miauth: z.boolean().default(true),
	}),
});
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	detail: z.boolean().default(true),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.adsRepository)
		private adsRepository: AdsRepository,

		private userEntityService: UserEntityService,
		private metaService: MetaService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const instance = await this.metaService.fetch(true);

			const ads = await this.adsRepository
				.createQueryBuilder('ads')
				.where('ads.expiresAt > :now', { now: new Date() })
				.andWhere('ads.startsAt <= :now', { now: new Date() })
				.andWhere(
					new Brackets((qb) => {
						// 曜日のビットフラグを確認する
						qb.where('ads.dayOfWeek & :dayOfWeek > 0', {
							dayOfWeek: 1 << new Date().getDay(),
						}).orWhere('ads.dayOfWeek = 0');
					}),
				)
				.getMany();

			const response: any = {
				maintainerName: instance.maintainerName,
				maintainerEmail: instance.maintainerEmail,

				version: this.config.version,

				name: instance.name,
				uri: this.config.url,
				description: instance.description,
				langs: instance.langs,
				tosUrl: instance.termsOfServiceUrl,
				repositoryUrl: instance.repositoryUrl,
				feedbackUrl: instance.feedbackUrl,
				disableRegistration: instance.disableRegistration,
				emailRequiredForSignup: instance.emailRequiredForSignup,
				enableHcaptcha: instance.enableHcaptcha,
				hcaptchaSiteKey: instance.hcaptchaSiteKey,
				enableRecaptcha: instance.enableRecaptcha,
				recaptchaSiteKey: instance.recaptchaSiteKey,
				enableTurnstile: instance.enableTurnstile,
				turnstileSiteKey: instance.turnstileSiteKey,
				swPublickey: instance.swPublicKey,
				themeColor: instance.themeColor,
				mascotImageUrl: instance.mascotImageUrl,
				bannerUrl: instance.bannerUrl,
				infoImageUrl: instance.infoImageUrl,
				serverErrorImageUrl: instance.serverErrorImageUrl,
				notFoundImageUrl: instance.notFoundImageUrl,
				iconUrl: instance.iconUrl,
				backgroundImageUrl: instance.backgroundImageUrl,
				logoImageUrl: instance.logoImageUrl,
				maxNoteTextLength: MAX_NOTE_TEXT_LENGTH,
				// クライアントの手間を減らすためあらかじめJSONに変換しておく
				defaultLightTheme: instance.defaultLightTheme
					? JSON.stringify(JSON5.parse(instance.defaultLightTheme))
					: null,
				defaultDarkTheme: instance.defaultDarkTheme
					? JSON.stringify(JSON5.parse(instance.defaultDarkTheme))
					: null,
				ads: ads.map((ad) => ({
					id: ad.id,
					url: ad.url,
					place: ad.place,
					ratio: ad.ratio,
					imageUrl: ad.imageUrl,
					dayOfWeek: ad.dayOfWeek,
				})),
				enableEmail: instance.enableEmail,
				enableServiceWorker: instance.enableServiceWorker,

				translatorAvailable: instance.deeplAuthKey != null,

				serverRules: instance.serverRules,

				policies: { ...DEFAULT_POLICIES, ...instance.policies },

				mediaProxy: this.config.mediaProxy,

				...(ps.detail
					? {
							cacheRemoteFiles: instance.cacheRemoteFiles,
							cacheRemoteSensitiveFiles: instance.cacheRemoteSensitiveFiles,
							requireSetup:
								(await this.usersRepository.countBy({
									host: IsNull(),
								})) === 0,
					  }
					: {}),
			};

			if (ps.detail) {
				const proxyAccount = instance.proxyAccountId
					? await this.userEntityService
							.pack(instance.proxyAccountId)
							.catch(() => null)
					: null;

				response.proxyAccountName = proxyAccount ? proxyAccount.username : null;
				response.features = {
					registration: !instance.disableRegistration,
					emailRequiredForSignup: instance.emailRequiredForSignup,
					hcaptcha: instance.enableHcaptcha,
					recaptcha: instance.enableRecaptcha,
					turnstile: instance.enableTurnstile,
					objectStorage: instance.useObjectStorage,
					serviceWorker: instance.enableServiceWorker,
					miauth: true,
				};
			}

			return response satisfies z.infer<typeof res>;
		});
	}
}
