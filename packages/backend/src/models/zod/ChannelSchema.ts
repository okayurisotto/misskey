import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';

export const ChannelSchema = z.object({
	id: misskeyIdPattern,
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
	userId: misskeyIdPattern.nullable(),
	pinnedNoteIds: z.array(misskeyIdPattern),
	color: z.string(),
});
