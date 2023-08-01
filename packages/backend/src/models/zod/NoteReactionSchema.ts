import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const NoteReactionSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	user: UserLiteSchema,
	type: z.string(),
});
