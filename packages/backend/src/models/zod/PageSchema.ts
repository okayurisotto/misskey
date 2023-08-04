import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';
import { DriveFileSchema } from './DriveFileSchema.js';

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
	hideTitleWhenPinned: z.boolean(),
	alignCenter: z.boolean(),
	font: z.string(),
	script: z.string(),
	eyeCatchingImageId: z.string().nullable(),
	eyeCatchingImage: DriveFileSchema.nullable(),
	attachedFiles: z.array(DriveFileSchema),
	likedCount: z.number().int(),
	isLiked: z.boolean().optional(),
});
