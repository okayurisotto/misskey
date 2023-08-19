import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { PageSchema } from './PageSchema.js';
import { NoteSchema } from './NoteSchema.js';
import { RoleSchema } from './RoleSchema.js';
import { UserFieldsSchema } from './UserFieldsSchema.js';

export const UserDetailedNotMeOnlySchema = z.object({
	url: z.string().url().nullable(),
	uri: z.string().url().nullable(),
	movedTo: z.string().url().nullable(),
	alsoKnownAs: z.array(MisskeyIdSchema).nullable(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().nullable(),
	lastFetchedAt: z.string().datetime().nullable(),
	bannerUrl: z.string().url().nullable(),
	bannerBlurhash: z.string().nullable(),
	isLocked: z.boolean(),
	isSilenced: z.boolean(),
	isSuspended: z.boolean(),
	description: z.string().nullable(),
	location: z.string().nullable(),
	birthday: z.string().nullable(),
	lang: z.string().nullable(),
	fields: UserFieldsSchema,
	followersCount: z.number(),
	followingCount: z.number(),
	notesCount: z.number(),
	pinnedNoteIds: z.array(MisskeyIdSchema),
	pinnedNotes: z.array(NoteSchema),
	pinnedPageId: z.string().nullable(),
	pinnedPage: PageSchema.nullable(),
	publicReactions: z.boolean(),
	twoFactorEnabled: z.boolean(),
	usePasswordLessLogin: z.boolean(),
	securityKeys: z.boolean(),
	memo: z.string().nullable(),
	roles: z.array(
		RoleSchema.pick({
			id: true,
			name: true,
			color: true,
			iconUrl: true,
			description: true,
			isModerator: true,
			isAdministrator: true,
			displayOrder: true,
		}),
	),
	moderationNote: z.string().optional(),
	ffVisibility: z.enum(['public', 'followers', 'private']),
});
