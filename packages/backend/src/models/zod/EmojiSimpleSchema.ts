import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';

export const EmojiSimpleSchema = z.object({
	aliases: z.array(MisskeyIdSchema),
	name: z.string(),
	category: z.string().nullable(),
	url: z.string(),
	isSensitive: z.boolean().optional(),
	roleIdsThatCanBeUsedThisEmojiAsReaction: z.array(MisskeyIdSchema).optional(),
});
