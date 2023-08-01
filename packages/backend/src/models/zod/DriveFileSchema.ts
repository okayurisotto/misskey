import { z } from 'zod';
import { MisskeyIdSchema, MD5Schema } from './misc.js';
import { DriveFolderSchema } from './DriveFolderSchema.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const DriveFileSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	name: z.string(),
	type: z.string(),
	md5: MD5Schema,
	size: z.number(),
	isSensitive: z.boolean(),
	blurhash: z.string().nullable(),
	properties: z.object({
		width: z.number().optional(),
		height: z.number().optional(),
		orientation: z.number().optional(),
		avgColor: z.string().optional(),
	}),
	url: z.string().url().nullable(),
	thumbnailUrl: z.string().url().nullable(),
	comment: z.string().nullable(),
	folderId: MisskeyIdSchema.nullable(),
	folder: DriveFolderSchema.nullable().optional(),
	userId: MisskeyIdSchema.nullable(),
	user: UserLiteSchema.nullable().optional(),
});
