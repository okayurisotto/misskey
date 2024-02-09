import { Injectable } from '@nestjs/common';
import type { EmojiSimpleSchema } from '@/models/zod/EmojiSimpleSchema.js';
import type { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';
import { EntityMap } from '@/misc/EntityMap.js';
import type { z } from 'zod';
import type { CustomEmoji } from '@prisma/client';

@Injectable()
export class EmojiEntityService {
	public packSimple(
		id: string,
		data: { emoji: EntityMap<'id', CustomEmoji> },
	): z.infer<typeof EmojiSimpleSchema> {
		const emoji = data.emoji.get(id);

		return {
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			url: emoji.publicUrl === '' ? emoji.originalUrl : emoji.publicUrl, // 後方互換性
			isSensitive: emoji.isSensitive ? true : undefined,
			roleIdsThatCanBeUsedThisEmojiAsReaction:
				emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.length > 0
					? emoji.roleIdsThatCanBeUsedThisEmojiAsReaction
					: undefined,
		};
	}

	public packDetailed(
		id: string,
		data: { emoji: EntityMap<'id', CustomEmoji> },
	): z.infer<typeof EmojiDetailedSchema> {
		const emoji = data.emoji.get(id);

		return {
			id: emoji.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: emoji.host,
			url: emoji.publicUrl === '' ? emoji.originalUrl : emoji.publicUrl, // 後方互換性
			license: emoji.license,
			isSensitive: emoji.isSensitive,
			localOnly: emoji.localOnly,
			roleIdsThatCanBeUsedThisEmojiAsReaction:
				emoji.roleIdsThatCanBeUsedThisEmojiAsReaction,
		};
	}
}
