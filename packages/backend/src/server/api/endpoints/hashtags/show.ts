import { noSuchHashtag } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { HashtagEntityService } from '@/core/entities/HashtagEntityService.js';
import { HashtagSchema } from '@/models/zod/HashtagSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = HashtagSchema;
export const meta = {
	tags: ['hashtags'],
	requireCredential: false,
	res,
	errors: {noSuchHashtag:noSuchHashtag},
} as const;

export const paramDef = z.object({
	tag: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly hashtagEntityService: HashtagEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const hashtag = await this.prismaService.client.hashtag.findUnique({
				where: {
					name: normalizeForSearch(ps.tag),
				},
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
