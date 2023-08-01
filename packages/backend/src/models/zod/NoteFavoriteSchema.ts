import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { NoteSchema } from './NoteSchema.js';

export const NoteFavoriteSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	note: NoteSchema,
	noteId: MisskeyIdSchema,
});
