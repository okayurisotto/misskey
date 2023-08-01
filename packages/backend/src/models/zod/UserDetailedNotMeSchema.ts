import { UserLiteSchema } from './UserLiteSchema.js';
import { UserDetailedNotMeOnlySchema } from './UserDetailedNotMeOnlySchema.js';

export const UserDetailedNotMeSchema = UserLiteSchema.merge(
	UserDetailedNotMeOnlySchema,
);
