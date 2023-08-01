import { UserLiteSchema } from './UserLiteSchema.js';
import { UserDetailedNotMeOnlySchema } from './UserDetailedNotMeOnlySchema.js';
import { MeDetailedOnlySchema } from './MeDetailedOnlySchema.js';

export const MeDetailedSchema = UserLiteSchema.merge(
	UserDetailedNotMeOnlySchema,
).merge(MeDetailedOnlySchema);
