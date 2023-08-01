import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';

export const UserListSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	name: z.string(),
	userIds: z.array(misskeyIdPattern).optional(),
	isPublic: z.boolean(),
});
