import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = EmojiDetailedSchema;
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,
	res,
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
		super(meta, paramDef, async (ps, me) => {
			const emoji = await this.prismaService.client.emoji.findFirstOrThrow({
				where: {
					name: ps.name,
					host: null,
				},
			});

			return (await this.emojiEntityService.packDetailed(
				emoji,
			)) satisfies z.infer<typeof res>;
		});
	}
}
