import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';

export const UserListSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	name: z.string(),
	userIds: z.array(MisskeyIdSchema).optional(),
	isPublic: z.boolean(),
});
