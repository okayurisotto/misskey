import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserDetailedSchema } from './UserDetailedSchema.js';

export const RenoteMutingSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	muteeId: misskeyIdPattern,
	mutee: UserDetailedSchema,
});
