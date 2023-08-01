import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { HashtagsRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';

const res = z.array(z.string());
export const meta = {
	tags: ['hashtags'],
	requireCredential: false,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	query: z.string(),
	offset: z.number().int().default(0),
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
	) {
		super(meta, paramDef_, async (ps, me) => {
			const hashtags = await this.hashtagsRepository
				.createQueryBuilder('tag')
				.where('tag.name like :q', {
					q: sqlLikeEscape(ps.query.toLowerCase()) + '%',
				})
				.orderBy('tag.count', 'DESC')
				.groupBy('tag.id')
				.limit(ps.limit)
				.offset(ps.offset)
				.getMany();

			return hashtags.map((tag) => tag.name) satisfies z.infer<typeof res>;
		});
	}
}
