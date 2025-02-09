import { z } from 'zod';
import { AdLiteSchema } from './AdLiteSchema.js';
import { InstanceFeaturesSchema } from './InstanceFeaturesSchema.js';

export const MetaSchema = z.object({
	ads: z.array(AdLiteSchema),
	backgroundImageUrl: z.string().nullable(),
	bannerUrl: z.string().nullable(),
	cacheRemoteFiles: z.boolean().optional(),
	cacheRemoteSensitiveFiles: z.boolean().optional(),
	defaultDarkTheme: z.string().nullable(),
	defaultLightTheme: z.string().nullable(),
	description: z.string().nullable(),
	disableRegistration: z.boolean(),
	emailRequiredForSignup: z.boolean(),
	enableEmail: z.boolean(),
	enableHcaptcha: z.boolean(),
	enableRecaptcha: z.boolean(),
	enableServiceWorker: z.boolean(),
	enableTurnstile: z.boolean(),
	features: InstanceFeaturesSchema.optional(),
	feedbackUrl: z.string().nullable(),
	hcaptchaSiteKey: z.string().nullable(),
	iconUrl: z.string().nullable(),
	infoImageUrl: z.string().nullable(),
	langs: z.array(z.string()),
	logoImageUrl: z.string().nullable(),
	maintainerEmail: z.string().nullable(),
	maintainerName: z.string().nullable(),
	mascotImageUrl: z.string().nullable(),
	maxNoteTextLength: z.number(),
	mediaProxy: z.string(),
	name: z.string().nullable(),
	notFoundImageUrl: z.string().nullable(),
	policies: z.record(z.string(), z.unknown()),
	proxyAccountName: z.string().nullable().optional(),
	recaptchaSiteKey: z.string().nullable(),
	repositoryUrl: z.string(),
	requireSetup: z.boolean().optional(),
	serverErrorImageUrl: z.string().nullable(),
	serverRules: z.array(z.string()),
	swPublickey: z.string().nullable(),
	themeColor: z.string().nullable(),
	tosUrl: z.string().nullable(),
	translatorAvailable: z.boolean(),
	turnstileSiteKey: z.string().nullable(),
	uri: z.string().url(),
	version: z.string(),
});
