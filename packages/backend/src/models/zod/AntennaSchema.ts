import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';

export const AntennaSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	name: z.string(),
	keywords: z.array(z.array(z.string())),
	excludeKeywords: z.array(z.array(z.string())),
	src: z.enum(['home', 'all', 'users', 'list']),
	userListId: MisskeyIdSchema.nullable(),
	users: z.array(z.string()),
	caseSensitive: z.boolean(),
	notify: z.boolean(),
	withReplies: z.boolean(),
	withFile: z.boolean(),
	isActive: z.boolean(),
	hasUnreadNote: z.boolean(),
});
