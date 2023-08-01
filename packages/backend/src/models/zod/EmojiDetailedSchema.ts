import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';

export const EmojiDetailedSchema = z.object({
	id: misskeyIdPattern,
	aliases: z.array(misskeyIdPattern),
	name: z.string(),
	category: z.string().nullable(),
	host: z.string().nullable(),
	url: z.string(),
	license: z.string().nullable(),
	isSensitive: z.boolean(),
	localOnly: z.boolean(),
	roleIdsThatCanBeUsedThisEmojiAsReaction: z.array(misskeyIdPattern),
});
