import { z } from 'zod';

export const InstanceFeaturesSchema = z.object({
	emailRequiredForSignup: z.boolean().optional(),
	globalTimeLine: z.boolean().optional(),
	hcaptcha: z.boolean(),
	localTimeLine: z.boolean().optional(),
	miauth: z.boolean().default(true),
	objectStorage: z.boolean(),
	recaptcha: z.boolean(),
	registration: z.boolean(),
	serviceWorker: z.boolean(),
	turnstile: z.boolean().optional(),
});
