import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { GalleryLikesRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { GalleryLikeEntityService } from '@/core/entities/GalleryLikeEntityService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';

const res = z.array(
	z.object({
		id: misskeyIdPattern,
		post: GalleryPostSchema,
	}),
);
export const meta = {
	tags: ['account', 'gallery'],
	requireCredential: true,
	kind: 'read:gallery-likes',
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
		@Inject(DI.galleryLikesRepository)
		private galleryLikesRepository: GalleryLikesRepository,

		private galleryLikeEntityService: GalleryLikeEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.galleryLikesRepository.createQueryBuilder('like'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('like.userId = :meId', { meId: me.id })
				.leftJoinAndSelect('like.post', 'post');

			const likes = await query.limit(ps.limit).getMany();

			return (await this.galleryLikeEntityService.packMany(
				likes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
