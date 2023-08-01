import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const ClipSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	lastClippedAt: z.string().datetime().nullable(),
	userId: misskeyIdPattern,
	user: UserLiteSchema,
	name: z.string(),
	description: z.string().nullable(),
	isPublic: z.boolean(),
	isFavorited: z.boolean().optional(),
	favoritedCount: z.number(),
});
