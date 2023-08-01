import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { ModerationLogsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogEntityService } from '@/core/entities/ModerationLogEntityService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';

const res = z.array(
	z.object({
		id: misskeyIdPattern,
		createdAt: z.string().datetime(),
		type: z.string(),
		info: z.unknown(),
		userId: misskeyIdPattern,
		user: UserDetailedSchema,
	}),
);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
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
		@Inject(DI.moderationLogsRepository)
		private moderationLogsRepository: ModerationLogsRepository,

		private moderationLogEntityService: ModerationLogEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(
				this.moderationLogsRepository.createQueryBuilder('report'),
				ps.sinceId,
				ps.untilId,
			);

			const reports = await query.limit(ps.limit).getMany();

			return (await this.moderationLogEntityService.packMany(
				reports,
			)) satisfies z.infer<typeof res>;
		});
	}
}
