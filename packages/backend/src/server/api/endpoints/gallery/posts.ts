import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { GalleryPostsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { DI } from '@/di-symbols.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(GalleryPostSchema);
export const meta = {
	tags: ['gallery'],
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
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
		@Inject(DI.galleryPostsRepository)
		private galleryPostsRepository: GalleryPostsRepository,

		private galleryPostEntityService: GalleryPostEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.galleryPostsRepository.createQueryBuilder('post'),
					ps.sinceId,
					ps.untilId,
				)
				.innerJoinAndSelect('post.user', 'user');

			const posts = await query.limit(ps.limit).getMany();

			return (await this.galleryPostEntityService.packMany(
				posts,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
