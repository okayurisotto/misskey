import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { FollowingsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { FollowingEntityService } from '@/core/entities/FollowingEntityService.js';
import { DI } from '@/di-symbols.js';
import { FollowingSchema } from '@/models/zod/FollowingSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(FollowingSchema);
export const meta = {
	tags: ['federation'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	host: z.string(),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	limit: z.number().int().min(1).max(100).default(10),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private followingEntityService: FollowingEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.followingsRepository.createQueryBuilder('following'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('following.followeeHost = :host', { host: ps.host });

			const followings = await query.limit(ps.limit).getMany();

			return (await this.followingEntityService.packMany(followings, me, {
				populateFollowee: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
