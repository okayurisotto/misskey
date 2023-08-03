import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { EmojisRepository } from '@/models/index.js';
import type { } from '@/models/entities/Blocking.js';
import type { Emoji } from '@/models/entities/Emoji.js';
import { bindThis } from '@/decorators.js';
import type { EmojiSimpleSchema } from '@/models/zod/EmojiSimpleSchema.js';
import type { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';
import type { z } from 'zod';

@Injectable()
export class EmojiEntityService {
	constructor(
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,
	) {
	}

	@bindThis
	public async packSimple(
		src: Emoji['id'] | Emoji,
	): Promise<z.infer<typeof EmojiSimpleSchema>> {
		const emoji = typeof src === 'object' ? src : await this.emojisRepository.findOneByOrFail({ id: src });

		return {
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
			url: emoji.publicUrl || emoji.originalUrl,
			isSensitive: emoji.isSensitive ? true : undefined,
			roleIdsThatCanBeUsedThisEmojiAsReaction: emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.length > 0 ? emoji.roleIdsThatCanBeUsedThisEmojiAsReaction : undefined,
		};
	}

	@bindThis
	public async packDetailed(
		src: Emoji['id'] | Emoji,
	): Promise<z.infer<typeof EmojiDetailedSchema>> {
		const emoji = typeof src === 'object' ? src : await this.emojisRepository.findOneByOrFail({ id: src });

		return {
			id: emoji.id,
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			host: emoji.host,
			// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
			url: emoji.publicUrl || emoji.originalUrl,
			license: emoji.license,
			isSensitive: emoji.isSensitive,
			localOnly: emoji.localOnly,
			roleIdsThatCanBeUsedThisEmojiAsReaction: emoji.roleIdsThatCanBeUsedThisEmojiAsReaction,
		};
	}
}
