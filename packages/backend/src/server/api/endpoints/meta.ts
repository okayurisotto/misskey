import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import JSON5 from 'json5';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { AdEntityService } from '@/core/entities/AdEntityService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { UserEntityPackLiteService } from '@/core/entities/UserEntityPackLiteService.js';
import { MetaSchema } from '../../../models/zod/MetaSchema.js';

const res = MetaSchema;
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
		private readonly adEntityService: AdEntityService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {
		super(meta, paramDef, async (ps) => {
			const instance = await this.metaService.fetch();

			const now = new Date();
			const dayOfWeek = 1 << now.getDay();
			const adPackData = await this.adEntityService.showMany({
				expiresAt: { gt: now },
				startsAt: { lte: now },
			});
			const ads = [...adPackData.ad.values()].filter((ad) => {
				return ad.dayOfWeek === 0 || (ad.dayOfWeek & dayOfWeek) > 0;
			});

			const response: z.infer<typeof res> = {
				maintainerName: instance.maintainerName,
				maintainerEmail: instance.maintainerEmail,

				version: this.configLoaderService.data.version,

				name: instance.name,
				uri: this.configLoaderService.data.url,
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
				ads: ads.map((ad) => {
					return this.adEntityService.packLite(ad.id, adPackData);
				}),
				enableEmail: instance.enableEmail,
				enableServiceWorker: instance.enableServiceWorker,

				translatorAvailable: instance.deeplAuthKey != null,

				serverRules: instance.serverRules,

				policies: {
					...DEFAULT_POLICIES,
					...z.record(z.string(), z.any()).parse(instance.policies),
				},

				mediaProxy: this.configLoaderService.data.mediaProxy.replace(/\/$/, ''),

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
				const getProxyAccount = async (): Promise<z.infer<
					typeof UserLiteSchema
				> | null> => {
					if (instance.proxyAccountId === null) return null;

					try {
						const proxyAccount =
							await this.prismaService.client.user.findUniqueOrThrow({
								where: { id: instance.proxyAccountId },
							});
						return await this.userEntityPackLiteService.packLite(proxyAccount);
					} catch {
						return null;
					}
				};

				const proxyAccount = await getProxyAccount();

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

			return response;
		});
	}
}
