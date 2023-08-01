import { z } from 'zod';
import { defineOpenApiSpec } from 'zod2spec';
import { MisskeyIdSchema } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';
import { DriveFileSchema } from './DriveFileSchema.js';

const NoteSchemaBase = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	deletedAt: z.string().datetime().nullable().optional(),
	text: z.string().nullable(),
	cw: z.string().nullable().optional(),
	userId: MisskeyIdSchema,
	user: UserLiteSchema,
	replyId: MisskeyIdSchema.nullable().optional(),
	renoteId: MisskeyIdSchema.nullable().optional(),
	isHidden: z.boolean().optional(),
	visibility: z.string(),
	mentions: z.array(MisskeyIdSchema).optional(),
	visibleUserIds: z.array(MisskeyIdSchema).optional(),
	fileIds: z.array(MisskeyIdSchema).optional(),
	files: z.array(DriveFileSchema).optional(),
	tags: z.array(z.string()).optional(),
	poll: z.unknown().nullable().optional(),
	channelId: MisskeyIdSchema.nullable().optional(),
	channel: z
		.object({ id: z.string(), name: z.string().nullable() })
		.nullable()
		.optional(),
	localOnly: z.boolean().optional(),
	reactionAcceptance: z.string().nullable(),
	reactions: z.unknown(),
	renoteCount: z.number(),
	repliesCount: z.number(),
	uri: z.string().optional(),
	url: z.string().optional(),
	myReaction: z.unknown().nullable().optional(),
});

type NoteSchemaType = z.infer<typeof NoteSchemaBase> & {
	reply?: NoteSchemaType | null;
	renote?: NoteSchemaType | null;
};

export const NoteSchema: z.ZodType<NoteSchemaType> = NoteSchemaBase.extend({
	reply: defineOpenApiSpec(
		z.lazy(() => NoteSchema.nullable()),
		{ $ref: '#/components/schemas/Note' },
	).optional(),
	renote: defineOpenApiSpec(
		z.lazy(() => NoteSchema.nullable()),
		{ $ref: '#/components/schemas/Note' },
	).optional(),
});
