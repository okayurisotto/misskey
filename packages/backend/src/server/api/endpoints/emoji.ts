import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { EmojisRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';

const res = EmojiDetailedSchema;
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	name: z.string(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private emojiEntityService: EmojiEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const emoji = await this.emojisRepository.findOneOrFail({
				where: {
					name: ps.name,
					host: IsNull(),
				},
			});

			return (await this.emojiEntityService.packDetailed(
				emoji,
			)) satisfies z.infer<typeof res>;
		});
	}
}
