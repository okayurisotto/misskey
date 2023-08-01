import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserDetailedSchema } from './UserDetailedSchema.js';

export const RenoteMutingSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	muteeId: MisskeyIdSchema,
	mutee: UserDetailedSchema,
});
