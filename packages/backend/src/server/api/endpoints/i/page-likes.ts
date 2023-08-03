import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { PageLikesRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { PageLikeEntityService } from '@/core/entities/PageLikeEntityService.js';
import { DI } from '@/di-symbols.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PageSchema } from '@/models/zod/PageSchema.js';

const res = z.array(
	z.object({
		id: MisskeyIdSchema,
		page: PageSchema,
	}),
);
export const meta = {
	tags: ['account', 'pages'],
	requireCredential: true,
	kind: 'read:page-likes',
	res,
} as const;

export const paramDef = z.object({
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
		@Inject(DI.pageLikesRepository)
		private pageLikesRepository: PageLikesRepository,

		private pageLikeEntityService: PageLikeEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.pageLikesRepository.createQueryBuilder('like'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('like.userId = :meId', { meId: me.id })
				.leftJoinAndSelect('like.page', 'page');

			const likes = await query.limit(ps.limit).getMany();

			return (await Promise.all(
				likes.map((like) => this.pageLikeEntityService.pack(like, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
