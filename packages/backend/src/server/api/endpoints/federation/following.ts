import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { FollowingsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { FollowingEntityService } from '@/core/entities/FollowingEntityService.js';
import { DI } from '@/di-symbols.js';
import { FollowingSchema } from '@/models/zod/FollowingSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(FollowingSchema);
export const meta = {
	tags: ['federation'],
	requireCredential: false,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	host: z.string(),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
	limit: z.number().int().min(1).max(100).default(10),
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
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private followingEntityService: FollowingEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.followingsRepository.createQueryBuilder('following'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('following.followerHost = :host', { host: ps.host });

			const followings = await query.limit(ps.limit).getMany();

			return (await this.followingEntityService.packMany(followings, me, {
				populateFollowee: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
