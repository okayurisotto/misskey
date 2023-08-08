import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { EmojiSimpleSchema } from '@/models/zod/EmojiSimpleSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({
	emojis: z.array(EmojiSimpleSchema),
});
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,
	res,
} as const;

export const paramDef = z.object({});

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
			const emojis = await this.prismaService.client.emoji.findMany({
				where: {
					host: null,
				},
				orderBy: [{ category: 'asc' }, { name: 'asc' }],
			});

			return {
				emojis: await Promise.all(
					emojis.map((emoji) => this.emojiEntityService.packSimple(emoji)),
				),
			} satisfies z.infer<typeof res>;
		});
	}
}
