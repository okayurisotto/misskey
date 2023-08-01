import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserDetailedSchema } from './UserDetailedSchema.js';

export const MutingSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	expiresAt: z.string().datetime().nullable(),
	muteeId: MisskeyIdSchema,
	mutee: UserDetailedSchema,
});
