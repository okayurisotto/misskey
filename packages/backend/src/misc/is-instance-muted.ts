import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import type { NotificationSchema } from '@/models/zod/NotificationSchema.js';
import type { z } from 'zod';

export function isInstanceMuted(note: z.infer<typeof NoteSchema>, mutedInstances: Set<string>): boolean {
	if (mutedInstances.has(note.user.host ?? '')) return true;
	if (mutedInstances.has(note.reply?.user.host ?? '')) return true;
	if (mutedInstances.has(note.renote?.user.host ?? '')) return true;

	return false;
}

export function isUserFromMutedInstance(notif: z.infer<typeof NotificationSchema>, mutedInstances: Set<string>): boolean {
	if (mutedInstances.has(notif.user?.host ?? '')) return true;

	return false;
}
