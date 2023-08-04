import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';

export const AdSchema = z.object({
	id: MisskeyIdSchema,
	dayOfWeek: z.number().int(),
	expiresAt: z.unknown(),
	imageUrl: z.string().min(1),
	memo: z.string(),
	place: z.string(),
	priority: z.string(),
	ratio: z.number().int(),
	startsAt: z.unknown(),
	url: z.string().min(1),
});
