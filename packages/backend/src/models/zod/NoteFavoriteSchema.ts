import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { NoteSchema } from './NoteSchema.js';

export const NoteFavoriteSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	note: NoteSchema,
	noteId: misskeyIdPattern,
});
