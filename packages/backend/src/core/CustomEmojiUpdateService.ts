import { Injectable } from '@nestjs/common';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { CustomEmojiLocalCacheService } from './CustomEmojiLocalCacheService.js';
import type { role, DriveFile, emoji } from '@prisma/client';

@Injectable()
export class CustomEmojiUpdateService {
	constructor(
		private readonly customEmojiLocalCacheService: CustomEmojiLocalCacheService,
		private readonly emojiEntityService: EmojiEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {}

	public async update(
		id: emoji['id'],
		data: {
			driveFile?: DriveFile;
			name?: string;
			category?: string | null;
			aliases?: string[];
			license?: string | null;
			isSensitive?: boolean;
			localOnly?: boolean;
			roleIdsThatCanBeUsedThisEmojiAsReaction?: role['id'][];
		},
	): Promise<void> {
		const emoji = await this.prismaService.client.emoji.findUniqueOrThrow({
			where: { id: id },
		});
		const sameNameEmoji = await this.prismaService.client.emoji.findFirst({
			where: { name: data.name, host: null },
		});
		if (sameNameEmoji != null && sameNameEmoji.id !== id)
			throw new Error('name already exists');

		await this.prismaService.client.emoji.update({
			where: { id: emoji.id },
			data: {
				updatedAt: new Date(),
				name: data.name,
				category: data.category,
				aliases: data.aliases,
				license: data.license,
				isSensitive: data.isSensitive,
				localOnly: data.localOnly,
				originalUrl: data.driveFile != null ? data.driveFile.url : undefined,
				publicUrl:
					data.driveFile != null
						? data.driveFile.webpublicUrl ?? data.driveFile.url
						: undefined,
				type:
					data.driveFile != null
						? data.driveFile.webpublicType ?? data.driveFile.type
						: undefined,
				roleIdsThatCanBeUsedThisEmojiAsReaction:
					data.roleIdsThatCanBeUsedThisEmojiAsReaction ?? undefined,
			},
		});

		await this.customEmojiLocalCacheService.refresh();

		const updated = this.emojiEntityService.packDetailed(emoji.id, {
			emoji: new EntityMap('id', [emoji]),
		});

		if (emoji.name === data.name) {
			this.globalEventService.publishBroadcastStream('emojiUpdated', {
				emojis: [updated],
			});
		} else {
			this.globalEventService.publishBroadcastStream('emojiDeleted', {
				emojis: [
					this.emojiEntityService.packDetailed(emoji.id, {
						emoji: new EntityMap('id', [emoji]),
					}),
				],
			});

			this.globalEventService.publishBroadcastStream('emojiAdded', {
				emoji: updated,
			});
		}
	}
}
