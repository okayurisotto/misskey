import { z } from 'zod';
import { AdLiteSchema } from './AdLiteSchema.js';

export const AdSchema = AdLiteSchema.extend({
	createdAt: z.number().int(),
	expiresAt: z.number().int(),
	memo: z.string(),
	priority: z.string(),
	startsAt: z.number().int(),
});
