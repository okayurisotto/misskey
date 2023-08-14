import { z } from 'zod';
import type { antenna } from '@prisma/client';

type ExportedAntennaSchemaType = Omit<
	antenna,
	| 'id'
	| 'createdAt'
	| 'userId'
	| 'userListId'
	| 'expression'
	| 'lastUsedAt'
	| 'isActive'
> & {
	userListAccts: string[] | null;
};

export const ExportedAntennaSchema = z.object({
	name: z.string(),
	src: z.enum(['home', 'all', 'users', 'list']),
	keywords: z.array(z.array(z.string())),
	excludeKeywords: z.array(z.array(z.string())),
	users: z.array(z.string()),
	userListAccts: z.array(z.string()).nullable(),
	caseSensitive: z.boolean(),
	withReplies: z.boolean(),
	withFile: z.boolean(),
	notify: z.boolean(),
}) satisfies z.ZodType<ExportedAntennaSchemaType>;
