import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const ClipSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	lastClippedAt: z.string().datetime().nullable(),
	userId: MisskeyIdSchema,
	user: UserLiteSchema,
	name: z.string(),
	description: z.string().nullable(),
	isPublic: z.boolean(),
	isFavorited: z.boolean().optional(),
	favoritedCount: z.number(),
});
