import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';

export const ChannelSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	lastNotedAt: z.string().datetime().nullable(),
	name: z.string(),
	description: z.string().nullable(),
	bannerUrl: z.string().url().nullable(),
	isArchived: z.boolean(),
	notesCount: z.number(),
	usersCount: z.number(),
	isFollowing: z.boolean().optional(),
	isFavorited: z.boolean().optional(),
	userId: MisskeyIdSchema.nullable(),
	pinnedNoteIds: z.array(MisskeyIdSchema),
	color: z.string(),
});
