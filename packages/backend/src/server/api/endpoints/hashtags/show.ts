import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { HashtagsRepository } from '@/models/index.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { HashtagEntityService } from '@/core/entities/HashtagEntityService.js';
import { DI } from '@/di-symbols.js';
import { HashtagSchema } from '@/models/zod/HashtagSchema.js';
import { ApiError } from '../../error.js';

const res = HashtagSchema;
export const meta = {
	tags: ['hashtags'],
	requireCredential: false,
	res: generateSchema(res),
	errors: {
		noSuchHashtag: {
			message: 'No such hashtag.',
			code: 'NO_SUCH_HASHTAG',
			id: '110ee688-193e-4a3a-9ecf-c167b2e6981e',
		},
	},
} as const;

const paramDef_ = z.object({
	tag: z.string(),
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
		@Inject(DI.hashtagsRepository)
		private hashtagsRepository: HashtagsRepository,

		private hashtagEntityService: HashtagEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const hashtag = await this.hashtagsRepository.findOneBy({
				name: normalizeForSearch(ps.tag),
			});
			if (hashtag == null) {
				throw new ApiError(meta.errors.noSuchHashtag);
			}

			return (await this.hashtagEntityService.pack(hashtag)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
