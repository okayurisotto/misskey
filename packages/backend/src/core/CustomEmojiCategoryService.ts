import { Injectable } from '@nestjs/common';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { CustomEmojiLocalCacheService } from './CustomEmojiLocalCacheService.js';
import type { CustomEmoji } from '@prisma/client';

@Injectable()
export class CustomEmojiCategoryService {
	constructor(
		private readonly customEmojiLocalCacheService: CustomEmojiLocalCacheService,
		private readonly emojiEntityService: EmojiEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {}

	public async setBulk(
		ids: CustomEmoji['id'][],
		category: string | null,
	): Promise<void> {
		await this.prismaService.client.customEmoji.updateMany({
			where: { id: { in: ids } },
			data: {
				updatedAt: new Date(),
				category: category,
			},
		});

		await this.customEmojiLocalCacheService.refresh();

		const emojis = await this.prismaService.client.customEmoji.findMany({
			where: { id: { in: ids } },
		});
		const data = { emoji: new EntityMap('id', emojis) };

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) =>
				this.emojiEntityService.packDetailed(emoji.id, data),
			),
		});
	}
}
