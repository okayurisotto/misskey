import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';

export const AdSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.number().int(),
	dayOfWeek: z.number().int(),
	expiresAt: z.number().int(),
	imageUrl: z.string().min(1),
	memo: z.string(),
	place: z.string(),
	priority: z.string(),
	ratio: z.number().int(),
	startsAt: z.number().int(),
	url: z.string().min(1),
});
