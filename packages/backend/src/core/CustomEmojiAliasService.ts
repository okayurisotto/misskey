import { Injectable } from '@nestjs/common';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import type { CustomEmoji } from '@prisma/client';

@Injectable()
export class CustomEmojiAliasService {
	constructor(
		private readonly emojiEntityService: EmojiEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {}

	public async setBulk(
		ids: CustomEmoji['id'][],
		aliases: string[],
	): Promise<void> {
		await this.prismaService.client.customEmoji.updateMany({
			where: { id: { in: ids } },
			data: {
				updatedAt: new Date(),
				aliases: aliases,
			},
		});

		const emojis = await this.prismaService.client.customEmoji.findMany({
			where: { id: { in: ids } },
		});
		const data = {
			emoji: new EntityMap('id', emojis),
		};

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) => {
				return this.emojiEntityService.packDetailed(emoji.id, data);
			}),
		});
	}

	public async addBulk(
		ids: CustomEmoji['id'][],
		aliases: string[],
	): Promise<void> {
		const emojis = await this.prismaService.client.customEmoji.findMany({
			where: { id: { in: ids } },
		});

		for (const emoji of emojis) {
			await this.prismaService.client.customEmoji.update({
				where: { id: emoji.id },
				data: {
					updatedAt: new Date(),
					aliases: [...new Set(emoji.aliases.concat(aliases))],
				},
			});
		}

		const data = {
			emoji: new EntityMap('id', emojis),
		};

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) => {
				return this.emojiEntityService.packDetailed(emoji.id, data);
			}),
		});
	}

	public async removeBulk(
		ids: CustomEmoji['id'][],
		aliases: string[],
	): Promise<void> {
		const emojis = await this.prismaService.client.customEmoji.findMany({
			where: { id: { in: ids } },
		});

		for (const emoji of emojis) {
			await this.prismaService.client.customEmoji.update({
				where: { id: emoji.id },
				data: {
					updatedAt: new Date(),
					aliases: emoji.aliases.filter((x) => !aliases.includes(x)),
				},
			});
		}

		const data = {
			emoji: new EntityMap('id', emojis),
		};

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) =>
				this.emojiEntityService.packDetailed(emoji.id, data),
			),
		});
	}
}
