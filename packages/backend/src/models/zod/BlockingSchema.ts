import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserDetailedSchema } from './UserDetailedSchema.js';

export const BlockingSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	blockeeId: misskeyIdPattern,
	blockee: UserDetailedSchema,
});
