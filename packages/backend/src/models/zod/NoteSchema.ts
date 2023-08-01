import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';
import { UserLiteSchema } from './UserLiteSchema.js';
import { DriveFileSchema } from './DriveFileSchema.js';

const NoteSchemaBase = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	deletedAt: z.string().datetime().nullable().optional(),
	text: z.string().nullable(),
	cw: z.string().nullable().optional(),
	userId: misskeyIdPattern,
	user: UserLiteSchema,
	replyId: misskeyIdPattern.nullable().optional(),
	renoteId: misskeyIdPattern.nullable().optional(),
	isHidden: z.boolean().optional(),
	visibility: z.string(),
	mentions: z.array(misskeyIdPattern).optional(),
	visibleUserIds: z.array(misskeyIdPattern).optional(),
	fileIds: z.array(misskeyIdPattern).optional(),
	files: z.array(DriveFileSchema).optional(),
	tags: z.array(z.string()).optional(),
	poll: z.unknown().nullable().optional(),
	channelId: misskeyIdPattern.nullable().optional(),
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
	reply: z.lazy(() => NoteSchema.nullable()).optional(),
	renote: z.lazy(() => NoteSchema.nullable()).optional(),
});
