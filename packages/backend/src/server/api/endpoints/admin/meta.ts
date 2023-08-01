import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.object({
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
	mascotImageUrl: z.string().default('/assets/ai.png').nullable(),
	bannerUrl: z.string().nullable(),
	serverErrorImageUrl: z.string().nullable(),
	infoImageUrl: z.string().nullable(),
	notFoundImageUrl: z.string().nullable(),
	iconUrl: z.string().nullable(),
	enableEmail: z.boolean(),
	enableServiceWorker: z.boolean(),
	translatorAvailable: z.boolean(),
	userStarForReactionFallback: z.boolean().optional(),
	pinnedUsers: z.array(z.string()).optional(),
	hiddenTags: z.array(z.string()).optional(),
	blockedHosts: z.array(z.string()).optional(),
	sensitiveWords: z.array(z.string()).optional(),
	preservedUsernames: z.array(z.string()),
	hcaptchaSecretKey: z.string().nullable().optional(),
	recaptchaSecretKey: z.string().nullable().optional(),
	turnstileSecretKey: z.string().nullable().optional(),
	sensitiveMediaDetection: z.string().optional(),
	sensitiveMediaDetectionSensitivity: z.string().optional(),
	setSensitiveFlagAutomatically: z.boolean().optional(),
	enableSensitiveMediaDetectionForVideos: z.boolean().optional(),
	proxyAccountId: misskeyIdPattern.nullable().optional(),
	summalyProxy: z.string().nullable().optional(),
	email: z.string().nullable().optional(),
	smtpSecure: z.boolean().optional(),
	smtpHost: z.string().nullable().optional(),
	smtpPort: z.number().nullable().optional(),
	smtpUser: z.string().nullable().optional(),
	smtpPass: z.string().nullable().optional(),
	swPrivateKey: z.string().nullable().optional(),
	useObjectStorage: z.boolean().optional(),
	objectStorageBaseUrl: z.string().nullable().optional(),
	objectStorageBucket: z.string().nullable().optional(),
	objectStoragePrefix: z.string().nullable().optional(),
	objectStorageEndpoint: z.string().nullable().optional(),
	objectStorageRegion: z.string().nullable().optional(),
	objectStoragePort: z.number().nullable().optional(),
	objectStorageAccessKey: z.string().nullable().optional(),
	objectStorageSecretKey: z.string().nullable().optional(),
	objectStorageUseSSL: z.boolean().optional(),
	objectStorageUseProxy: z.boolean().optional(),
	objectStorageSetPublicRead: z.boolean().optional(),
	enableIpLogging: z.boolean().optional(),
	enableActiveEmailValidation: z.boolean().optional(),
	enableChartsForRemoteUser: z.boolean(),
	enableChartsForFederatedInstances: z.boolean(),
	enableServerMachineStats: z.boolean(),
	enableIdenticonGeneration: z.boolean(),
	policies: z.unknown(),
});
export const meta = {
	tags: ['meta'],
	requireCredential: true,
	requireAdmin: true,
	res,
} as const;

export const paramDef = z.unknown();

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

		private metaService: MetaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const instance = await this.metaService.fetch(true);

			return {
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
				serverErrorImageUrl: instance.serverErrorImageUrl,
				notFoundImageUrl: instance.notFoundImageUrl,
				infoImageUrl: instance.infoImageUrl,
				iconUrl: instance.iconUrl,
				backgroundImageUrl: instance.backgroundImageUrl,
				logoImageUrl: instance.logoImageUrl,
				defaultLightTheme: instance.defaultLightTheme,
				defaultDarkTheme: instance.defaultDarkTheme,
				enableEmail: instance.enableEmail,
				enableServiceWorker: instance.enableServiceWorker,
				translatorAvailable: instance.deeplAuthKey != null,
				cacheRemoteFiles: instance.cacheRemoteFiles,
				cacheRemoteSensitiveFiles: instance.cacheRemoteSensitiveFiles,
				pinnedUsers: instance.pinnedUsers,
				hiddenTags: instance.hiddenTags,
				blockedHosts: instance.blockedHosts,
				sensitiveWords: instance.sensitiveWords,
				preservedUsernames: instance.preservedUsernames,
				hcaptchaSecretKey: instance.hcaptchaSecretKey,
				recaptchaSecretKey: instance.recaptchaSecretKey,
				turnstileSecretKey: instance.turnstileSecretKey,
				sensitiveMediaDetection: instance.sensitiveMediaDetection,
				sensitiveMediaDetectionSensitivity:
					instance.sensitiveMediaDetectionSensitivity,
				setSensitiveFlagAutomatically: instance.setSensitiveFlagAutomatically,
				enableSensitiveMediaDetectionForVideos:
					instance.enableSensitiveMediaDetectionForVideos,
				proxyAccountId: instance.proxyAccountId,
				summalyProxy: instance.summalyProxy,
				email: instance.email,
				smtpSecure: instance.smtpSecure,
				smtpHost: instance.smtpHost,
				smtpPort: instance.smtpPort,
				smtpUser: instance.smtpUser,
				smtpPass: instance.smtpPass,
				swPrivateKey: instance.swPrivateKey,
				useObjectStorage: instance.useObjectStorage,
				objectStorageBaseUrl: instance.objectStorageBaseUrl,
				objectStorageBucket: instance.objectStorageBucket,
				objectStoragePrefix: instance.objectStoragePrefix,
				objectStorageEndpoint: instance.objectStorageEndpoint,
				objectStorageRegion: instance.objectStorageRegion,
				objectStoragePort: instance.objectStoragePort,
				objectStorageAccessKey: instance.objectStorageAccessKey,
				objectStorageSecretKey: instance.objectStorageSecretKey,
				objectStorageUseSSL: instance.objectStorageUseSSL,
				objectStorageUseProxy: instance.objectStorageUseProxy,
				objectStorageSetPublicRead: instance.objectStorageSetPublicRead,
				objectStorageS3ForcePathStyle: instance.objectStorageS3ForcePathStyle,
				deeplAuthKey: instance.deeplAuthKey,
				deeplIsPro: instance.deeplIsPro,
				enableIpLogging: instance.enableIpLogging,
				enableActiveEmailValidation: instance.enableActiveEmailValidation,
				enableChartsForRemoteUser: instance.enableChartsForRemoteUser,
				enableChartsForFederatedInstances:
					instance.enableChartsForFederatedInstances,
				enableServerMachineStats: instance.enableServerMachineStats,
				enableIdenticonGeneration: instance.enableIdenticonGeneration,
				policies: { ...DEFAULT_POLICIES, ...instance.policies },
			} satisfies z.infer<typeof res>;
		});
	}
}
