import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { GalleryPostsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { DI } from '@/di-symbols.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(GalleryPostSchema);
export const meta = {
	tags: ['users', 'gallery'],
	description: 'Show all gallery posts by the given user.',
	res,
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.galleryPostsRepository)
		private galleryPostsRepository: GalleryPostsRepository,

		private galleryPostEntityService: GalleryPostEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.galleryPostsRepository.createQueryBuilder('post'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('post.userId = :userId', { userId: ps.userId });

			const posts = await query.limit(ps.limit).getMany();

			return (await Promise.all(
				posts.map((post) => this.galleryPostEntityService.pack(post, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
