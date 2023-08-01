import { z } from 'zod';

export const AppSchema = z.object({
	id: z.string(),
	name: z.string(),
	callbackUrl: z.string().nullable(),
	permission: z.array(z.string()),
	secret: z.string().optional(),
	isAuthorized: z.boolean().optional(),
});
