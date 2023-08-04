import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AdsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { AdSchema } from '@/models/zod/AdSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(AdSchema);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
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
		@Inject(DI.adsRepository)
		private adsRepository: AdsRepository,

		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(
				this.adsRepository.createQueryBuilder('ad'),
				ps.sinceId,
				ps.untilId,
			);
			const ads = await query.limit(ps.limit ?? 10).getMany();

			return ads satisfies z.infer<typeof res>;
		});
	}
}
