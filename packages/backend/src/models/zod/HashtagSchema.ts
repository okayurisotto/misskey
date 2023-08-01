import { z } from 'zod';

export const HashtagSchema = z.object({
	tag: z.string(),
	mentionedUsersCount: z.number(),
	mentionedLocalUsersCount: z.number(),
	mentionedRemoteUsersCount: z.number(),
	attachedUsersCount: z.number(),
	attachedLocalUsersCount: z.number(),
	attachedRemoteUsersCount: z.number(),
});
