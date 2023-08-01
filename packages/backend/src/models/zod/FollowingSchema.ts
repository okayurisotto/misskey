import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserDetailedSchema } from './UserDetailedSchema.js';

export const FollowingSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	followeeId: MisskeyIdSchema,
	followee: UserDetailedSchema.optional(),
	followerId: MisskeyIdSchema,
	follower: UserDetailedSchema.optional(),
});
