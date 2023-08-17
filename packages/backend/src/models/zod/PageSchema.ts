import { z } from 'zod';
import { defineOpenApiSpec } from 'zod2spec';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';
import { DriveFileSchema } from './DriveFileSchema.js';
import { PageContentSchema } from './PageContentSchema.js';

export const PageSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	title: z.string(),
	name: z.string(),
	summary: z.string().nullable(),
	content: PageContentSchema,
	variables: defineOpenApiSpec(z.array(z.never()), {
		type: 'array',
		maxItems: 0,
	}),
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
