import { z } from 'zod';
import { RoleCondForumaValueSchema } from './RoleCondFormula.js';
import { MisskeyIdSchema } from './misc.js';
import { RolePoliciesSchema } from './RolePoliciesSchema.js';

export const RoleSchema = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string(),
	updatedAt: z.string().nullable(),
	name: z.string(),
	description: z.string(),
	color: z.string().nullable(),
	iconUrl: z.string().nullable(),
	target: z.enum(['manual', 'conditional']),
	condFormula: RoleCondForumaValueSchema,
	isPublic: z.boolean(),
	isModerator: z.boolean(),
	isAdministrator: z.boolean(),
	isExplorable: z.boolean().default(false),
	asBadge: z.boolean(),
	canEditMembersByModerator: z.boolean(),
	displayOrder: z.number(),
	policies: RolePoliciesSchema,
	usersCount: z.number().int(),
});
