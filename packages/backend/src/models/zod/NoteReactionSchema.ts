import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const NoteReactionSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	user: UserLiteSchema,
	type: z.string(),
});
