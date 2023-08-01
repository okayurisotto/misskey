import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';

export const AntennaSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	name: z.string(),
	keywords: z.array(z.array(z.string())),
	excludeKeywords: z.array(z.array(z.string())),
	src: z.enum(['home', 'all', 'users', 'list']),
	userListId: misskeyIdPattern.nullable(),
	users: z.array(z.string()),
	caseSensitive: z.boolean(),
	notify: z.boolean(),
	withReplies: z.boolean(),
	withFile: z.boolean(),
	isActive: z.boolean(),
	hasUnreadNote: z.boolean(),
});
