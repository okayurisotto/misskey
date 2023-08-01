import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { PageEntityService } from '@/core/entities/PageEntityService.js';
import type { PagesRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { PageSchema } from '@/models/zod/PageSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(PageSchema);
export const meta = {
	tags: ['users', 'pages'],
	description: 'Show all pages this user created.',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	userId: misskeyIdPattern,
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
		@Inject(DI.pagesRepository)
		private pagesRepository: PagesRepository,

		private pageEntityService: PageEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.pagesRepository.createQueryBuilder('page'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('page.userId = :userId', { userId: ps.userId })
				.andWhere("page.visibility = 'public'");

			const pages = await query.limit(ps.limit).getMany();

			return (await this.pageEntityService.packMany(pages)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
