import { Injectable } from '@nestjs/common';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { CustomEmojiLocalCacheService } from './CustomEmojiLocalCacheService.js';
import type { emoji } from '@prisma/client';

@Injectable()
export class CustomEmojiAliasService {
	constructor(
		private readonly customEmojiLocalCacheService: CustomEmojiLocalCacheService,
		private readonly emojiEntityService: EmojiEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {}

	public async setBulk(ids: emoji['id'][], aliases: string[]): Promise<void> {
		await this.prismaService.client.emoji.updateMany({
			where: { id: { in: ids } },
			data: {
				updatedAt: new Date(),
				aliases: aliases,
			},
		});

		await this.customEmojiLocalCacheService.refresh();

		const emojis = await this.prismaService.client.emoji.findMany({
			where: { id: { in: ids } },
		});
		const data = { emoji: new EntityMap('id', emojis) };

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) =>
				this.emojiEntityService.packDetailed(emoji.id, data),
			),
		});
	}

	public async addBulk(ids: emoji['id'][], aliases: string[]): Promise<void> {
		const emojis = await this.prismaService.client.emoji.findMany({
			where: { id: { in: ids } },
		});

		for (const emoji of emojis) {
			await this.prismaService.client.emoji.update({
				where: { id: emoji.id },
				data: {
					updatedAt: new Date(),
					aliases: [...new Set(emoji.aliases.concat(aliases))],
				},
			});
		}

		await this.customEmojiLocalCacheService.refresh();

		const data = {
			emoji: new EntityMap('id', emojis),
		};

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) =>
				this.emojiEntityService.packDetailed(emoji.id, data),
			),
		});
	}

	public async removeBulk(
		ids: emoji['id'][],
		aliases: string[],
	): Promise<void> {
		const emojis = await this.prismaService.client.emoji.findMany({
			where: { id: { in: ids } },
		});

		for (const emoji of emojis) {
			await this.prismaService.client.emoji.update({
				where: { id: emoji.id },
				data: {
					updatedAt: new Date(),
					aliases: emoji.aliases.filter((x) => !aliases.includes(x)),
				},
			});
		}

		await this.customEmojiLocalCacheService.refresh();

		const data = { emoji: new EntityMap('id', emojis) };

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) =>
				this.emojiEntityService.packDetailed(emoji.id, data),
			),
		});
	}
}
