import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserDetailedSchema } from './UserDetailedSchema.js';

export const MutingSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	expiresAt: z.string().datetime().nullable(),
	muteeId: misskeyIdPattern,
	mutee: UserDetailedSchema,
});
