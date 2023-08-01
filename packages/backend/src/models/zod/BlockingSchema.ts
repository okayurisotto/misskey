import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserDetailedSchema } from './UserDetailedSchema.js';

export const BlockingSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	blockeeId: MisskeyIdSchema,
	blockee: UserDetailedSchema,
});
