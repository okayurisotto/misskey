import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserDetailedSchema } from './UserDetailedSchema.js';

export const FollowingSchema = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	followeeId: misskeyIdPattern,
	followee: UserDetailedSchema.optional(),
	followerId: misskeyIdPattern,
	follower: UserDetailedSchema.optional(),
});
