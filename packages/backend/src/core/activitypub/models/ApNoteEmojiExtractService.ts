import { Injectable } from '@nestjs/common';
import { toArray, toSingle } from '@/misc/prelude/array.js';
import type Logger from '@/misc/logger.js';
import { IdService } from '@/core/IdService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { isEmoji } from '../type.js';
import { ApLoggerService } from '../ApLoggerService.js';
import type { IObject } from '../type.js';
import type { CustomEmoji } from '@prisma/client';

@Injectable()
export class ApNoteEmojiExtractService {
	private readonly logger;

	constructor(
		private readonly apLoggerService: ApLoggerService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly utilityService: UtilityService,
	) {
		this.logger = this.apLoggerService.logger;
	}

	public async extractEmojis(
		tags: IObject | IObject[],
		host: string,
	): Promise<CustomEmoji[]> {
		// eslint-disable-next-line no-param-reassign
		host = this.utilityService.toPuny(host);

		const eomjiTags = toArray(tags).filter(isEmoji);

		const existingEmojis = await this.prismaService.client.customEmoji.findMany(
			{
				where: {
					host,
					name: { in: eomjiTags.map((tag) => tag.name.replaceAll(':', '')) },
				},
			},
		);

		return await Promise.all(
			eomjiTags.map(async (tag) => {
				const name = tag.name.replaceAll(':', '');
				tag.icon = toSingle(tag.icon);

				const exists = existingEmojis.find((x) => x.name === name);

				if (exists) {
					if (
						exists.updatedAt == null ||
						(tag.id != null && exists.uri == null) ||
						new Date(tag.updated) > exists.updatedAt ||
						tag.icon.url !== exists.originalUrl
					) {
						await this.prismaService.client.customEmoji.update({
							where: { name_host: { host, name } },
							data: {
								uri: tag.id,
								originalUrl: tag.icon.url,
								publicUrl: tag.icon.url,
								updatedAt: new Date(),
							},
						});

						const emoji =
							await this.prismaService.client.customEmoji.findUnique({
								where: { name_host: { host, name } },
							});
						if (emoji == null) throw new Error('emoji update failed');
						return emoji;
					}

					return exists;
				}

				this.logger.info(`register emoji host=${host}, name=${name}`);

				return await this.prismaService.client.customEmoji.create({
					data: {
						id: this.idService.genId(),
						host,
						name,
						uri: tag.id,
						originalUrl: tag.icon.url,
						publicUrl: tag.icon.url,
						updatedAt: new Date(),
						aliases: [],
					},
				});
			}),
		);
	}
}
