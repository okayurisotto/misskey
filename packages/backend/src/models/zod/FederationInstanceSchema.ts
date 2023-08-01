import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';

export const FederationInstanceSchema = z.object({
	id: misskeyIdPattern,
	firstRetrievedAt: z.string().datetime(),
	host: z.string(),
	usersCount: z.number(),
	notesCount: z.number(),
	followingCount: z.number(),
	followersCount: z.number(),
	isNotResponding: z.boolean(),
	isSuspended: z.boolean(),
	isBlocked: z.boolean(),
	softwareName: z.string().nullable(),
	softwareVersion: z.string().nullable(),
	openRegistrations: z.boolean().nullable(),
	name: z.string().nullable(),
	description: z.string().nullable(),
	maintainerName: z.string().nullable(),
	maintainerEmail: z.string().nullable(),
	iconUrl: z.string().url().nullable(),
	faviconUrl: z.string().url().nullable(),
	themeColor: z.string().nullable(),
	infoUpdatedAt: z.string().datetime().nullable(),
});
