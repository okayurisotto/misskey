import { z } from 'zod';
import { notificationTypes } from '@/types.js';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';
import { NoteSchema } from './NoteSchema.js';

export const NotificationSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	type: z.enum(notificationTypes),
	user: UserLiteSchema.nullable().optional(),
	userId: MisskeyIdSchema.nullable().optional(),
	note: NoteSchema.nullable().optional(),
	reaction: z.string().nullable().optional(),
	choice: z.number().nullable().optional(),
	invitation: z.unknown().nullable().optional(),
	body: z.string().nullable().optional(),
	header: z.string().nullable().optional(),
	icon: z.string().nullable().optional(),
});
