import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { EmojiSimpleSchema } from '@/models/zod/EmojiSimpleSchema.js';
import type { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { z } from 'zod';
import type { emoji } from '@prisma/client';

@Injectable()
export class EmojiEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * `emoji`を`packする
	 *
	 * @param src
	 * @returns
	 */
	@bindThis
	public async packSimple(
		src: emoji['id'] | emoji,
	): Promise<z.infer<typeof EmojiSimpleSchema>> {
		const emoji = typeof src === 'object'
			? src
			: await this.prismaService.client.emoji.findUniqueOrThrow({ where: { id: src } });

		return {
			aliases: emoji.aliases,
			name: emoji.name,
			category: emoji.category,
			url: emoji.publicUrl === '' ? emoji.originalUrl : emoji.publicUrl, // 後方互換性
			isSensitive: emoji.isSensitive ? true : undefined,
			roleIdsThatCanBeUsedThisEmojiAsReaction: emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.length > 0
				? emoji.roleIdsThatCanBeUsedThisEmojiAsReaction
				: undefined,
		};
	}

	/**
	 * `emoji`を`packする
	 *
	 * @param src
	 * @returns
	 */
	@bindThis
	public async packDetailed(
		src: emoji['id'] | emoji,
	): Promise<z.infer<typeof EmojiDetailedSchema>> {
		const emoji = typeof src === 'object'
			? src
			: await this.prismaService.client.emoji.findUniqueOrThrow({ where: { id: src } });

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
			roleIdsThatCanBeUsedThisEmojiAsReaction: emoji.roleIdsThatCanBeUsedThisEmojiAsReaction,
		};
	}
}
