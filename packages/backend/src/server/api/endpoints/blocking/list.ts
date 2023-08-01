import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { BlockingsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { BlockingEntityService } from '@/core/entities/BlockingEntityService.js';
import { DI } from '@/di-symbols.js';
import { BlockingSchema } from '@/models/zod/BlockingSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(BlockingSchema);
export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'read:blocks',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).default(30),
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
		@Inject(DI.blockingsRepository)
		private blockingsRepository: BlockingsRepository,

		private blockingEntityService: BlockingEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.blockingsRepository.createQueryBuilder('blocking'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('blocking.blockerId = :meId', { meId: me.id });

			const blockings = await query.limit(ps.limit).getMany();

			return (await this.blockingEntityService.packMany(
				blockings,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
