import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { FlashLikesRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { FlashLikeEntityService } from '@/core/entities/FlashLikeEntityService.js';
import { DI } from '@/di-symbols.js';
import { FlashSchema } from '@/models/zod/FlashSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(
	z.object({
		id: z.string(),
		flash: FlashSchema,
	}),
);
export const meta = {
	tags: ['account', 'flash'],
	requireCredential: true,
	kind: 'read:flash-likes',
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
		@Inject(DI.flashLikesRepository)
		private flashLikesRepository: FlashLikesRepository,

		private flashLikeEntityService: FlashLikeEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.flashLikesRepository.createQueryBuilder('like'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('like.userId = :meId', { meId: me.id })
				.leftJoinAndSelect('like.flash', 'flash');

			const likes = await query.limit(ps.limit).getMany();

			return (await this.flashLikeEntityService.packMany(
				likes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
