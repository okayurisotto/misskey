import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';
import { DriveFileSchema } from './DriveFileSchema.js';

export const GalleryPostSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	title: z.string(),
	description: z.string().nullable(),
	userId: MisskeyIdSchema,
	user: UserLiteSchema,
	fileIds: z.array(MisskeyIdSchema).optional(),
	files: z.array(DriveFileSchema).optional(),
	tags: z.array(z.string()).optional(),
	isSensitive: z.boolean(),
});
