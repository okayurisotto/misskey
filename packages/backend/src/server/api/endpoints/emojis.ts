import { z } from 'zod';
import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { EmojisRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { EmojiSimpleSchema } from '@/models/zod/EmojiSimpleSchema.js';

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
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private emojiEntityService: EmojiEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const emojis = await this.emojisRepository.find({
				where: {
					host: IsNull(),
				},
				order: {
					category: 'ASC',
					name: 'ASC',
				},
			});

			return {
				emojis: await Promise.all(
					emojis.map((emoji) => this.emojiEntityService.packSimple(emoji)),
				),
			} satisfies z.infer<typeof res>;
		});
	}
}
