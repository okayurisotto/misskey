import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import type { Role, DriveFile, CustomEmoji } from '@prisma/client';

@Injectable()
export class CustomEmojiAddService {
	constructor(
		private readonly emojiEntityService: EmojiEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async add(data: {
		driveFile: DriveFile;
		name: string;
		category: string | null;
		aliases: string[];
		host: string | null;
		license: string | null;
		isSensitive: boolean;
		localOnly: boolean;
		roleIdsThatCanBeUsedThisEmojiAsReaction: Role['id'][];
	}): Promise<CustomEmoji> {
		const emoji = await this.prismaService.client.customEmoji.create({
			data: {
				id: this.idService.genId(),
				updatedAt: new Date(),
				name: data.name,
				category: data.category,
				host: data.host,
				aliases: data.aliases,
				originalUrl: data.driveFile.url,
				publicUrl: data.driveFile.webpublicUrl ?? data.driveFile.url,
				type: data.driveFile.webpublicType ?? data.driveFile.type,
				license: data.license,
				isSensitive: data.isSensitive,
				localOnly: data.localOnly,
				roleIdsThatCanBeUsedThisEmojiAsReaction:
					data.roleIdsThatCanBeUsedThisEmojiAsReaction,
			},
		});

		if (data.host === null) {
			this.globalEventService.publishBroadcastStream('emojiAdded', {
				emoji: this.emojiEntityService.packDetailed(emoji.id, {
					emoji: new EntityMap('id', [emoji]),
				}),
			});
		}

		return emoji;
	}
}
