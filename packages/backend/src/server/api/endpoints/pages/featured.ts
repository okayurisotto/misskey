import { z } from 'zod';
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
	res,
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.pagesRepository)
		private pagesRepository: PagesRepository,

		private pageEntityService: PageEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.pagesRepository
				.createQueryBuilder('page')
				.where("page.visibility = 'public'")
				.andWhere('page.likedCount > 0')
				.orderBy('page.likedCount', 'DESC');

			const pages = await query.limit(10).getMany();

			return (await Promise.all(
				pages.map((page) => this.pageEntityService.pack(page, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
