import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';

export const EmojiSimpleSchema = z.object({
	aliases: z.array(misskeyIdPattern),
	name: z.string(),
	category: z.string().nullable(),
	url: z.string(),
	isSensitive: z.boolean().optional(),
	roleIdsThatCanBeUsedThisEmojiAsReaction: z.array(misskeyIdPattern).optional(),
});
