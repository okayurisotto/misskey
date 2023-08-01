import { UserLiteSchema } from './UserLiteSchema.js';
import { UserDetailedSchema } from './UserDetailedSchema.js';

export const UserSchema = UserLiteSchema.or(UserDetailedSchema);
