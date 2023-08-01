import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const FlashSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	title: z.string(),
	summary: z.string(),
	script: z.string(),
	userId: misskeyIdPattern,
	user: UserLiteSchema,
	likedCount: z.number().nullable(),
	isLiked: z.boolean().optional(),
});
