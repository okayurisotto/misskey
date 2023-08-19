import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { FederationInstanceLiteSchema } from './FederationInstanceLiteSchema.js';

const BadgeRole = z.object({
	name: z.string(),
	iconUrl: z.string().nullable(),
	displayOrder: z.number(),
});

export const UserLiteSchema = z.object({
	id: MisskeyIdSchema,
	name: z.string().nullable(),
	username: z.string(),
	host: z.string().nullable(),
	avatarUrl: z.string().url(),
	avatarBlurhash: z.string().nullable(),
	badgeRoles: z.array(BadgeRole).optional(),
	emojis: z.record(z.string(), z.string()),
	instance: FederationInstanceLiteSchema.optional(),
	onlineStatus: z.enum(['unknown', 'online', 'active', 'offline']),
	isBot: z.boolean(),
	isCat: z.boolean(),
});
