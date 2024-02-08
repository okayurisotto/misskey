import { Injectable } from '@nestjs/common';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { CustomEmojiLocalCacheService } from './CustomEmojiLocalCacheService.js';
import type { CustomEmoji } from '@prisma/client';

@Injectable()
export class CustomEmojiDeleteService {
	constructor(
		private readonly customEmojiLocalCacheService: CustomEmojiLocalCacheService,
		private readonly emojiEntityService: EmojiEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {}

	public async delete(id: CustomEmoji['id']): Promise<void> {
		const emoji = await this.prismaService.client.customEmoji.delete({
			where: { id },
		});

		this.customEmojiLocalCacheService.refresh();

		this.globalEventService.publishBroadcastStream('emojiDeleted', {
			emojis: [
				this.emojiEntityService.packDetailed(emoji.id, {
					emoji: new EntityMap('id', [emoji]),
				}),
			],
		});
	}

	public async deleteBulk(ids: CustomEmoji['id'][]): Promise<void> {
		const emojis = await this.prismaService.client.customEmoji.findMany({
			where: { id: { in: ids } },
		});

		for (const emoji of emojis) {
			await this.prismaService.client.customEmoji.delete({ where: { id: emoji.id } });
		}

		await this.customEmojiLocalCacheService.refresh();

		const data = { emoji: new EntityMap('id', emojis) };

		this.globalEventService.publishBroadcastStream('emojiDeleted', {
			emojis: emojis.map((emoji) =>
				this.emojiEntityService.packDetailed(emoji.id, data),
			),
		});
	}
}
