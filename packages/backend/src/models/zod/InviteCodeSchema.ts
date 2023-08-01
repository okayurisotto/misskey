import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const InviteCodeSchema = z.object({
	id: MisskeyIdSchema,
	code: z.string(),
	expiresAt: z.string().datetime().nullable(),
	createdAt: z.string().datetime(),
	createdBy: UserLiteSchema.nullable(),
	usedBy: UserLiteSchema.nullable(),
	usedAt: z.string().datetime().nullable(),
	used: z.boolean(),
});
