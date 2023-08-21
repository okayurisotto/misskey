import { z } from 'zod';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

export const AnnouncementSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().nullable(),
	text: z.string(),
	title: z.string(),
	imageUrl: z.string().nullable(),
	reads: z.number(),
});
