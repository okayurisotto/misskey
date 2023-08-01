import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';

export const UserLiteSchema = z.object({
	id: misskeyIdPattern,
	name: z.string().nullable(),
	username: z.string(),
	host: z.string().nullable(),
	avatarUrl: z.string().url().nullable(),
	avatarBlurhash: z.string().nullable(),
	isAdmin: z.boolean().optional(),
	isModerator: z.boolean().optional(),
	isBot: z.boolean().optional(),
	isCat: z.boolean().optional(),
	onlineStatus: z.enum(['unknown', 'online', 'active', 'offline']).nullable(),
});
