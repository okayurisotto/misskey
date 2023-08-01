import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import type { FollowRequestsRepository } from '@/models/index.js';
import { FollowRequestEntityService } from '@/core/entities/FollowRequestEntityService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';

const res = z.array(
	z.object({
		id: misskeyIdPattern,
		follower: UserLiteSchema,
		followee: UserLiteSchema,
	}),
);
export const meta = {
	tags: ['following', 'account'],
	requireCredential: true,
	kind: 'read:following',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
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
		@Inject(DI.followRequestsRepository)
		private followRequestsRepository: FollowRequestsRepository,

		private followRequestEntityService: FollowRequestEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.followRequestsRepository.createQueryBuilder('request'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('request.followeeId = :meId', { meId: me.id });

			const requests = await query.limit(ps.limit).getMany();

			return (await Promise.all(
				requests.map((req) => this.followRequestEntityService.pack(req)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
