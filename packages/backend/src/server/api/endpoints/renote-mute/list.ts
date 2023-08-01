import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RenoteMutingsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { RenoteMutingEntityService } from '@/core/entities/RenoteMutingEntityService.js';
import { DI } from '@/di-symbols.js';
import { RenoteMutingSchema } from '@/models/zod/RenoteMutingSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(RenoteMutingSchema);
export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'read:mutes',
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(30),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.renoteMutingsRepository)
		private renoteMutingsRepository: RenoteMutingsRepository,

		private renoteMutingEntityService: RenoteMutingEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.renoteMutingsRepository.createQueryBuilder('muting'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('muting.muterId = :meId', { meId: me.id });

			const mutings = await query.limit(ps.limit).getMany();

			return (await this.renoteMutingEntityService.packMany(
				mutings,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
