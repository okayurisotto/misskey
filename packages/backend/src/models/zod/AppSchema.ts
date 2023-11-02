import { z } from 'zod';

export const AppLiteSchema = z.object({
	id: z.string(),
	name: z.string(),
	callbackUrl: z.string().nullable(),
	permission: z.array(z.string()),
});

export const AppSecretOnlySchema = z.object({
	secret: z.string(),
});

export const AppIsAuthorizedOnlySchema = z.object({
	isAuthorized: z.boolean(),
});

/** @deprecated */
export const AppSchema = AppLiteSchema.merge(
	AppSecretOnlySchema.partial(),
).merge(AppIsAuthorizedOnlySchema.partial());
