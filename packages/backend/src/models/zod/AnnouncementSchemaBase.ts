import { z } from 'zod';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

export const AnnouncementSchemaBase = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().nullable(),
	title: z.string(),
	text: z.string(),
	imageUrl: z.string().nullable(),
});
