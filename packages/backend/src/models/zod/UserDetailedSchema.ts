import { UserDetailedNotMeSchema } from './UserDetailedNotMeSchema.js';
import { MeDetailedSchema } from './MeDetailedSchema.js';

export const UserDetailedSchema = UserDetailedNotMeSchema.or(MeDetailedSchema);
