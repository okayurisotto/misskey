import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const PageSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	title: z.string(),
	name: z.string(),
	summary: z.string().nullable(),
	content: z.array(z.unknown()),
	variables: z.array(z.unknown()),
	userId: misskeyIdPattern,
	user: UserLiteSchema,
});
