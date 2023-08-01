import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';
import { DriveFileSchema } from './DriveFileSchema.js';

export const GalleryPostSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	title: z.string(),
	description: z.string().nullable(),
	userId: misskeyIdPattern,
	user: UserLiteSchema,
	fileIds: z.array(misskeyIdPattern).optional(),
	files: z.array(DriveFileSchema).optional(),
	tags: z.array(z.string()).optional(),
	isSensitive: z.boolean(),
});
