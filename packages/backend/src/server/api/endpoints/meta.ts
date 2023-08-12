import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import JSON5 from 'json5';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MetaService } from '@/core/MetaService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({
	maintainerName: z.string().nullable(),
	maintainerEmail: z.string().nullable(),
	version: z.string(),
	name: z.string().nullable(),
	uri: z.string().url(),
	description: z.string().nullable(),
	langs: z.array(z.string()),
	tosUrl: z.string().nullable(),
	repositoryUrl: z.string(), // https://github.com/misskey-dev/misskey
	feedbackUrl: z.string().nullable(), // https://github.com/misskey-dev/misskey/issues/new
	defaultDarkTheme: z.string().nullable(),
	defaultLightTheme: z.string().nullable(),
	disableRegistration: z.boolean(),
	cacheRemoteFiles: z.boolean().optional(),
	cacheRemoteSensitiveFiles: z.boolean().optional(),
	emailRequiredForSignup: z.boolean(),
	enableHcaptcha: z.boolean(),
	hcaptchaSiteKey: z.string().nullable(),
	enableRecaptcha: z.boolean(),
	recaptchaSiteKey: z.string().nullable(),
	enableTurnstile: z.boolean(),
	turnstileSiteKey: z.string().nullable(),
	swPublickey: z.string().nullable(),
	mascotImageUrl: z.string().nullable(),
	bannerUrl: z.string().nullable(),
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
	requireSetup: z.boolean().optional(),
	enableEmail: z.boolean(),
	enableServiceWorker: z.boolean(),
	translatorAvailable: z.boolean(),
	proxyAccountName: z.string().nullable().optional(),
	mediaProxy: z.string(),
	features: z
		.object({
			registration: z.boolean(),
			localTimeLine: z.boolean().optional(),
			globalTimeLine: z.boolean().optional(),
			hcaptcha: z.boolean(),
			recaptcha: z.boolean(),
			objectStorage: z.boolean(),
			serviceWorker: z.boolean(),
			miauth: z.boolean().default(true),
			emailRequiredForSignup: z.boolean().optional(),
			turnstile: z.boolean().optional(),
		})
		.optional(),
	themeColor: z.string().nullable(),
	backgroundImageUrl: z.string().nullable(),
	logoImageUrl: z.string().nullable(),
	serverRules: z.array(z.string()),
	policies: z.record(z.string(), z.unknown()),
});
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	detail: z.boolean().default(true),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private readonly userEntityService: UserEntityService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const instance = await this.metaService.fetch(true);

			const now = new Date();
			const dayOfWeek = 1 << now.getDay();
			const ads = (
				await this.prismaService.client.ad.findMany({
					where: {
						expiresAt: { gt: now },
						startsAt: { lte: now },
					},
				})
			).filter((ad) => ad.dayOfWeek === 0 || (ad.dayOfWeek & dayOfWeek) > 0);

			const response: z.infer<typeof res> = {
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

				policies: {
					...DEFAULT_POLICIES,
					...z.record(z.string(), z.any()).parse(instance.policies),
				},

				mediaProxy: this.config.mediaProxy,

				...(ps.detail
					? {
							cacheRemoteFiles: instance.cacheRemoteFiles,
							cacheRemoteSensitiveFiles: instance.cacheRemoteSensitiveFiles,
							requireSetup:
								(await this.prismaService.client.user.count({
									where: { host: null },
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
