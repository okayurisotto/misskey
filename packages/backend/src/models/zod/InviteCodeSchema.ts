import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const InviteCodeSchema = z.object({
	id: misskeyIdPattern,
	code: z.string(),
	expiresAt: z.string().datetime().nullable(),
	createdAt: z.string().datetime(),
	createdBy: UserLiteSchema.nullable(),
	usedBy: UserLiteSchema.nullable(),
	usedAt: z.string().datetime().nullable(),
	used: z.boolean(),
});
