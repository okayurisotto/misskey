import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { PagesRepository, PageLikesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['pages'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:page-likes',
	errors: {
		noSuchPage: {
			message: 'No such page.',
			code: 'NO_SUCH_PAGE',
			id: 'a0d41e20-1993-40bd-890e-f6e560ae648e',
		},
		notLiked: {
			message: 'You have not liked that page.',
			code: 'NOT_LIKED',
			id: 'f5e586b0-ce93-4050-b0e3-7f31af5259ee',
		},
	},
} as const;

const paramDef_ = z.object({
	pageId: misskeyIdPattern,
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.pagesRepository)
		private pagesRepository: PagesRepository,

		@Inject(DI.pageLikesRepository)
		private pageLikesRepository: PageLikesRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const page = await this.pagesRepository.findOneBy({ id: ps.pageId });
			if (page == null) {
				throw new ApiError(meta.errors.noSuchPage);
			}

			const exist = await this.pageLikesRepository.findOneBy({
				pageId: page.id,
				userId: me.id,
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notLiked);
			}

			// Delete like
			await this.pageLikesRepository.delete(exist.id);

			this.pagesRepository.decrement({ id: page.id }, 'likedCount', 1);
		});
	}
}
