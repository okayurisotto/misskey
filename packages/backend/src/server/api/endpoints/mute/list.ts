import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { MutingsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { MutingEntityService } from '@/core/entities/MutingEntityService.js';
import { DI } from '@/di-symbols.js';
import { MutingSchema } from '@/models/zod/MutingSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(MutingSchema);
export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'read:mutes',
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
		@Inject(DI.mutingsRepository)
		private mutingsRepository: MutingsRepository,

		private mutingEntityService: MutingEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.mutingsRepository.createQueryBuilder('muting'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('muting.muterId = :meId', { meId: me.id });

			const mutings = await query.limit(ps.limit).getMany();

			return (await this.mutingEntityService.packMany(
				mutings,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
