import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const PageSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	title: z.string(),
	name: z.string(),
	summary: z.string().nullable(),
	content: z.array(z.unknown()),
	variables: z.array(z.unknown()),
	userId: MisskeyIdSchema,
	user: UserLiteSchema,
});
