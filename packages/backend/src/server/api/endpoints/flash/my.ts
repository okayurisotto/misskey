import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { FlashsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';
import { DI } from '@/di-symbols.js';
import { FlashSchema } from '@/models/zod/FlashSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(FlashSchema);
export const meta = {
	tags: ['account', 'flash'],
	requireCredential: true,
	kind: 'read:flash',
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
		@Inject(DI.flashsRepository)
		private flashsRepository: FlashsRepository,

		private flashEntityService: FlashEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.flashsRepository.createQueryBuilder('flash'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('flash.userId = :meId', { meId: me.id });

			const flashs = await query.limit(ps.limit).getMany();

			return (await this.flashEntityService.packMany(flashs)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
