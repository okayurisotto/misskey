import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';

export const AdLiteSchema = z.object({
	id: MisskeyIdSchema,
	dayOfWeek: z.number().int(),
	imageUrl: z.string().min(1),
	place: z.string(),
	ratio: z.number().int(),
	url: z.string().min(1),
});
