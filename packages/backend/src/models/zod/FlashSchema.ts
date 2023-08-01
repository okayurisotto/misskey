import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const FlashSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	title: z.string(),
	summary: z.string(),
	script: z.string(),
	userId: MisskeyIdSchema,
	user: UserLiteSchema,
	likedCount: z.number().nullable(),
	isLiked: z.boolean().optional(),
});
