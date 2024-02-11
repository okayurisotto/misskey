import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import type { Meta } from '@prisma/client';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = z.object({
	disableRegistration: z.boolean().nullable().optional(),
	pinnedUsers: z.array(z.string()).nullable().optional(),
	hiddenTags: z.array(z.string()).nullable().optional(),
	blockedHosts: z.array(z.string()).nullable().optional(),
	sensitiveWords: z.array(z.string()).nullable().optional(),
	themeColor: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.nullable()
		.optional(),
	mascotImageUrl: z.string().nullable().optional(),
	bannerUrl: z.string().nullable().optional(),
	serverErrorImageUrl: z.string().nullable().optional(),
	infoImageUrl: z.string().nullable().optional(),
	notFoundImageUrl: z.string().nullable().optional(),
	iconUrl: z.string().nullable().optional(),
	backgroundImageUrl: z.string().nullable().optional(),
	logoImageUrl: z.string().nullable().optional(),
	name: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	defaultLightTheme: z.string().nullable().optional(),
	defaultDarkTheme: z.string().nullable().optional(),
	cacheRemoteFiles: z.boolean().optional(),
	cacheRemoteSensitiveFiles: z.boolean().optional(),
	emailRequiredForSignup: z.boolean().optional(),
	enableHcaptcha: z.boolean().optional(),
	hcaptchaSiteKey: z.string().nullable().optional(),
	hcaptchaSecretKey: z.string().nullable().optional(),
	enableRecaptcha: z.boolean().optional(),
	recaptchaSiteKey: z.string().nullable().optional(),
	recaptchaSecretKey: z.string().nullable().optional(),
	enableTurnstile: z.boolean().optional(),
	turnstileSiteKey: z.string().nullable().optional(),
	turnstileSecretKey: z.string().nullable().optional(),
	sensitiveMediaDetection: z
		.enum(['none', 'all', 'local', 'remote'])
		.optional(),
	sensitiveMediaDetectionSensitivity: z
		.enum(['medium', 'low', 'high', 'veryLow', 'veryHigh'])
		.optional(),
	setSensitiveFlagAutomatically: z.boolean().optional(),
	enableSensitiveMediaDetectionForVideos: z.boolean().optional(),
	proxyAccountId: MisskeyIdSchema.nullable().optional(),
	maintainerName: z.string().nullable().optional(),
	maintainerEmail: z.string().nullable().optional(),
	langs: z.array(z.string()).optional(),
	summalyProxy: z.string().nullable().optional(),
	deeplAuthKey: z.string().nullable().optional(),
	deeplIsPro: z.boolean().optional(),
	enableEmail: z.boolean().optional(),
	email: z.string().nullable().optional(),
	smtpSecure: z.boolean().optional(),
	smtpHost: z.string().nullable().optional(),
	smtpPort: z.number().int().nullable().optional(),
	smtpUser: z.string().nullable().optional(),
	smtpPass: z.string().nullable().optional(),
	enableServiceWorker: z.boolean().optional(),
	swPublicKey: z.string().nullable().optional(),
	swPrivateKey: z.string().nullable().optional(),
	tosUrl: z.string().nullable().optional(),
	repositoryUrl: z.string().optional(),
	feedbackUrl: z.string().optional(),
	useObjectStorage: z.boolean().optional(),
	objectStorageBaseUrl: z.string().nullable().optional(),
	objectStorageBucket: z.string().nullable().optional(),
	objectStoragePrefix: z.string().nullable().optional(),
	objectStorageEndpoint: z.string().nullable().optional(),
	objectStorageRegion: z.string().nullable().optional(),
	objectStoragePort: z.number().int().nullable().optional(),
	objectStorageAccessKey: z.string().nullable().optional(),
	objectStorageSecretKey: z.string().nullable().optional(),
	objectStorageUseSSL: z.boolean().optional(),
	objectStorageUseProxy: z.boolean().optional(),
	objectStorageSetPublicRead: z.boolean().optional(),
	objectStorageS3ForcePathStyle: z.boolean().optional(),
	enableIpLogging: z.boolean().optional(),
	enableActiveEmailValidation: z.boolean().optional(),
	enableChartsForRemoteUser: z.boolean().optional(),
	enableChartsForFederatedInstances: z.boolean().optional(),
	enableServerMachineStats: z.boolean().optional(),
	enableIdenticonGeneration: z.boolean().optional(),
	serverRules: z.array(z.string()).optional(),
	preservedUsernames: z.array(z.string()).optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly metaService: MetaService,
		private readonly moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const set: Partial<Omit<Meta, 'id' | 'policies'>> = {};

			if (typeof ps.disableRegistration === 'boolean') {
				set.disableRegistration = ps.disableRegistration;
			}

			if (Array.isArray(ps.pinnedUsers)) {
				set.pinnedUsers = ps.pinnedUsers.filter(Boolean);
			}

			if (Array.isArray(ps.hiddenTags)) {
				set.hiddenTags = ps.hiddenTags.filter(Boolean);
			}

			if (Array.isArray(ps.blockedHosts)) {
				set.blockedHosts = ps.blockedHosts
					.filter(Boolean)
					.map((x) => x.toLowerCase());
			}

			if (Array.isArray(ps.sensitiveWords)) {
				set.sensitiveWords = ps.sensitiveWords.filter(Boolean);
			}

			if (ps.themeColor !== undefined) {
				set.themeColor = ps.themeColor;
			}

			if (ps.mascotImageUrl !== undefined) {
				set.mascotImageUrl = ps.mascotImageUrl;
			}

			if (ps.bannerUrl !== undefined) {
				set.bannerUrl = ps.bannerUrl;
			}

			if (ps.iconUrl !== undefined) {
				set.iconUrl = ps.iconUrl;
			}

			if (ps.serverErrorImageUrl !== undefined) {
				set.serverErrorImageUrl = ps.serverErrorImageUrl;
			}

			if (ps.infoImageUrl !== undefined) {
				set.infoImageUrl = ps.infoImageUrl;
			}

			if (ps.notFoundImageUrl !== undefined) {
				set.notFoundImageUrl = ps.notFoundImageUrl;
			}

			if (ps.backgroundImageUrl !== undefined) {
				set.backgroundImageUrl = ps.backgroundImageUrl;
			}

			if (ps.logoImageUrl !== undefined) {
				set.logoImageUrl = ps.logoImageUrl;
			}

			if (ps.name !== undefined) {
				set.name = ps.name;
			}

			if (ps.description !== undefined) {
				set.description = ps.description;
			}

			if (ps.defaultLightTheme !== undefined) {
				set.defaultLightTheme = ps.defaultLightTheme;
			}

			if (ps.defaultDarkTheme !== undefined) {
				set.defaultDarkTheme = ps.defaultDarkTheme;
			}

			if (ps.cacheRemoteFiles !== undefined) {
				set.cacheRemoteFiles = ps.cacheRemoteFiles;
			}

			if (ps.cacheRemoteSensitiveFiles !== undefined) {
				set.cacheRemoteSensitiveFiles = ps.cacheRemoteSensitiveFiles;
			}

			if (ps.emailRequiredForSignup !== undefined) {
				set.emailRequiredForSignup = ps.emailRequiredForSignup;
			}

			if (ps.enableHcaptcha !== undefined) {
				set.enableHcaptcha = ps.enableHcaptcha;
			}

			if (ps.hcaptchaSiteKey !== undefined) {
				set.hcaptchaSiteKey = ps.hcaptchaSiteKey;
			}

			if (ps.hcaptchaSecretKey !== undefined) {
				set.hcaptchaSecretKey = ps.hcaptchaSecretKey;
			}

			if (ps.enableRecaptcha !== undefined) {
				set.enableRecaptcha = ps.enableRecaptcha;
			}

			if (ps.recaptchaSiteKey !== undefined) {
				set.recaptchaSiteKey = ps.recaptchaSiteKey;
			}

			if (ps.recaptchaSecretKey !== undefined) {
				set.recaptchaSecretKey = ps.recaptchaSecretKey;
			}

			if (ps.enableTurnstile !== undefined) {
				set.enableTurnstile = ps.enableTurnstile;
			}

			if (ps.turnstileSiteKey !== undefined) {
				set.turnstileSiteKey = ps.turnstileSiteKey;
			}

			if (ps.turnstileSecretKey !== undefined) {
				set.turnstileSecretKey = ps.turnstileSecretKey;
			}

			if (ps.sensitiveMediaDetection !== undefined) {
				set.sensitiveMediaDetection = ps.sensitiveMediaDetection;
			}

			if (ps.sensitiveMediaDetectionSensitivity !== undefined) {
				set.sensitiveMediaDetectionSensitivity =
					ps.sensitiveMediaDetectionSensitivity;
			}

			if (ps.setSensitiveFlagAutomatically !== undefined) {
				set.setSensitiveFlagAutomatically = ps.setSensitiveFlagAutomatically;
			}

			if (ps.enableSensitiveMediaDetectionForVideos !== undefined) {
				set.enableSensitiveMediaDetectionForVideos =
					ps.enableSensitiveMediaDetectionForVideos;
			}

			if (ps.proxyAccountId !== undefined) {
				set.proxyAccountId = ps.proxyAccountId;
			}

			if (ps.maintainerName !== undefined) {
				set.maintainerName = ps.maintainerName;
			}

			if (ps.maintainerEmail !== undefined) {
				set.maintainerEmail = ps.maintainerEmail;
			}

			if (Array.isArray(ps.langs)) {
				set.langs = ps.langs.filter(Boolean);
			}

			if (ps.summalyProxy !== undefined) {
				set.summalyProxy = ps.summalyProxy;
			}

			if (ps.enableEmail !== undefined) {
				set.enableEmail = ps.enableEmail;
			}

			if (ps.email !== undefined) {
				set.email = ps.email;
			}

			if (ps.smtpSecure !== undefined) {
				set.smtpSecure = ps.smtpSecure;
			}

			if (ps.smtpHost !== undefined) {
				set.smtpHost = ps.smtpHost;
			}

			if (ps.smtpPort !== undefined) {
				set.smtpPort = ps.smtpPort;
			}

			if (ps.smtpUser !== undefined) {
				set.smtpUser = ps.smtpUser;
			}

			if (ps.smtpPass !== undefined) {
				set.smtpPass = ps.smtpPass;
			}

			if (ps.enableServiceWorker !== undefined) {
				set.enableServiceWorker = ps.enableServiceWorker;
			}

			if (ps.swPublicKey !== undefined) {
				set.swPublicKey = ps.swPublicKey;
			}

			if (ps.swPrivateKey !== undefined) {
				set.swPrivateKey = ps.swPrivateKey;
			}

			if (ps.tosUrl !== undefined) {
				set.termsOfServiceUrl = ps.tosUrl;
			}

			if (ps.repositoryUrl !== undefined) {
				set.repositoryUrl = ps.repositoryUrl;
			}

			if (ps.feedbackUrl !== undefined) {
				set.feedbackUrl = ps.feedbackUrl;
			}

			if (ps.useObjectStorage !== undefined) {
				set.useObjectStorage = ps.useObjectStorage;
			}

			if (ps.objectStorageBaseUrl !== undefined) {
				set.objectStorageBaseUrl = ps.objectStorageBaseUrl;
			}

			if (ps.objectStorageBucket !== undefined) {
				set.objectStorageBucket = ps.objectStorageBucket;
			}

			if (ps.objectStoragePrefix !== undefined) {
				set.objectStoragePrefix = ps.objectStoragePrefix;
			}

			if (ps.objectStorageEndpoint !== undefined) {
				set.objectStorageEndpoint = ps.objectStorageEndpoint;
			}

			if (ps.objectStorageRegion !== undefined) {
				set.objectStorageRegion = ps.objectStorageRegion;
			}

			if (ps.objectStoragePort !== undefined) {
				set.objectStoragePort = ps.objectStoragePort;
			}

			if (ps.objectStorageAccessKey !== undefined) {
				set.objectStorageAccessKey = ps.objectStorageAccessKey;
			}

			if (ps.objectStorageSecretKey !== undefined) {
				set.objectStorageSecretKey = ps.objectStorageSecretKey;
			}

			if (ps.objectStorageUseSSL !== undefined) {
				set.objectStorageUseSSL = ps.objectStorageUseSSL;
			}

			if (ps.objectStorageUseProxy !== undefined) {
				set.objectStorageUseProxy = ps.objectStorageUseProxy;
			}

			if (ps.objectStorageSetPublicRead !== undefined) {
				set.objectStorageSetPublicRead = ps.objectStorageSetPublicRead;
			}

			if (ps.objectStorageS3ForcePathStyle !== undefined) {
				set.objectStorageS3ForcePathStyle = ps.objectStorageS3ForcePathStyle;
			}

			if (ps.deeplAuthKey !== undefined) {
				if (ps.deeplAuthKey === '') {
					set.deeplAuthKey = null;
				} else {
					set.deeplAuthKey = ps.deeplAuthKey;
				}
			}

			if (ps.deeplIsPro !== undefined) {
				set.deeplIsPro = ps.deeplIsPro;
			}

			if (ps.enableIpLogging !== undefined) {
				set.enableIpLogging = ps.enableIpLogging;
			}

			if (ps.enableActiveEmailValidation !== undefined) {
				set.enableActiveEmailValidation = ps.enableActiveEmailValidation;
			}

			if (ps.enableChartsForRemoteUser !== undefined) {
				set.enableChartsForRemoteUser = ps.enableChartsForRemoteUser;
			}

			if (ps.enableChartsForFederatedInstances !== undefined) {
				set.enableChartsForFederatedInstances =
					ps.enableChartsForFederatedInstances;
			}

			if (ps.enableServerMachineStats !== undefined) {
				set.enableServerMachineStats = ps.enableServerMachineStats;
			}

			if (ps.enableIdenticonGeneration !== undefined) {
				set.enableIdenticonGeneration = ps.enableIdenticonGeneration;
			}

			if (ps.serverRules !== undefined) {
				set.serverRules = ps.serverRules;
			}

			if (ps.preservedUsernames !== undefined) {
				set.preservedUsernames = ps.preservedUsernames;
			}

			await Promise.all([
				this.metaService.update(set),
				this.moderationLogService.insertModerationLog(me, 'updateMeta'),
			]);
		});
	}
}
