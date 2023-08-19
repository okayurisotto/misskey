import { z } from 'zod';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

export const UserSecretsSchema = z.object({
	email: z.string().nullable(),
	emailVerified: z.boolean(),
	securityKeysList: z.array(
		z.object({
			id: MisskeyIdSchema,
			name: z.string(),
			lastUsed: z.date(),
		}),
	),
});
