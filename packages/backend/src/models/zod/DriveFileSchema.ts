import { z } from 'zod';
import { misskeyIdPattern, md5Pattern } from './misc.js';
import { DriveFolderSchema } from './DriveFolderSchema.js';
import { UserLiteSchema } from './UserLiteSchema.js';

export const DriveFileSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	name: z.string(),
	type: z.string(),
	md5: md5Pattern,
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
	folderId: misskeyIdPattern.nullable(),
	folder: DriveFolderSchema.nullable().optional(),
	userId: misskeyIdPattern.nullable(),
	user: UserLiteSchema.nullable().optional(),
});
