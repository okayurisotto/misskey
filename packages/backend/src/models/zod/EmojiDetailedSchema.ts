import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';

export const EmojiDetailedSchema = z.object({
	id: MisskeyIdSchema,
	aliases: z.array(MisskeyIdSchema),
	name: z.string(),
	category: z.string().nullable(),
	host: z.string().nullable(),
	url: z.string(),
	license: z.string().nullable(),
	isSensitive: z.boolean(),
	localOnly: z.boolean(),
	roleIdsThatCanBeUsedThisEmojiAsReaction: z.array(MisskeyIdSchema),
});
