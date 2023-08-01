import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { FlashLikesRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { FlashLikeEntityService } from '@/core/entities/FlashLikeEntityService.js';
import { DI } from '@/di-symbols.js';
import { FlashSchema } from '@/models/zod/FlashSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

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
		@Inject(DI.flashLikesRepository)
		private flashLikesRepository: FlashLikesRepository,

		private flashLikeEntityService: FlashLikeEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
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
