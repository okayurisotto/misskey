import { z } from 'zod';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { UserSchema } from '@/models/zod/UserSchema.js';

export const AbuseUserReportSchema = z.object({
	id: MisskeyIdSchema,
	assignee: UserSchema.nullable().optional(),
	assigneeId: MisskeyIdSchema.nullable(),
	comment: z.string(),
	createdAt: z.string().datetime(),
	forwarded: z.boolean(),
	reporter: UserSchema,
	reporterId: MisskeyIdSchema,
	resolved: z.boolean(),
	targetUser: UserSchema,
	targetUserId: MisskeyIdSchema,
});
