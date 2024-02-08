import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { ApiError } from '../error.js';
import { noSuchEmoji } from '../errors.js';

const res = EmojiDetailedSchema;
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,
	res,
	errors: { noSuchEmoji: noSuchEmoji },
} as const;

export const paramDef = z.object({
	name: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly emojiEntityService: EmojiEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const emoji = await this.prismaService.client.customEmoji.findFirst({
				where: {
					name: ps.name,
					host: null,
				},
			});

			if (emoji === null) {
				throw new ApiError(meta.errors.noSuchEmoji);
			}

			return this.emojiEntityService.packDetailed(emoji.id, {
				emoji: new EntityMap('id', [emoji]),
			});
		});
	}
}
