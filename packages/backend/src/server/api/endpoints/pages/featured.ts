import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { PagesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PageEntityService } from '@/core/entities/PageEntityService.js';
import { DI } from '@/di-symbols.js';
import { PageSchema } from '@/models/zod/PageSchema.js';

const res = z.array(PageSchema);
export const meta = {
	tags: ['pages'],
	requireCredential: false,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({});
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
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.pagesRepository
				.createQueryBuilder('page')
				.where("page.visibility = 'public'")
				.andWhere('page.likedCount > 0')
				.orderBy('page.likedCount', 'DESC');

			const pages = await query.limit(10).getMany();

			return (await this.pageEntityService.packMany(
				pages,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
