import { UserLiteSchema } from './UserLiteSchema.js';
import { UserDetailedNotMeOnlySchema } from './UserDetailedNotMeOnlySchema.js';
import { UserRelationSchema } from './UserRelationSchema.js';

const UserDetailedSchema = UserLiteSchema.merge(UserDetailedNotMeOnlySchema);
export const UserDetailedNotMeSchema = UserDetailedSchema.merge(UserRelationSchema);
