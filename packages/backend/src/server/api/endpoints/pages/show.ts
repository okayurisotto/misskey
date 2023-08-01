import { z } from 'zod';
import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository, PagesRepository } from '@/models/index.js';
import type { Page } from '@/models/entities/Page.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PageEntityService } from '@/core/entities/PageEntityService.js';
import { DI } from '@/di-symbols.js';
import { PageSchema } from '@/models/zod/PageSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = PageSchema;
export const meta = {
	tags: ['pages'],
	requireCredential: false,
	res,
	errors: {
		noSuchPage: {
			message: 'No such page.',
			code: 'NO_SUCH_PAGE',
			id: '222120c0-3ead-4528-811b-b96f233388d7',
		},
	},
} as const;

export const paramDef = z.union([
	z.object({
		pageId: MisskeyIdSchema,
	}),
	z.object({
		name: z.string(),
		username: z.string(),
	}),
]);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.pagesRepository)
		private pagesRepository: PagesRepository,

		private pageEntityService: PageEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let page: Page | null = null;

			if ('pageId' in ps) {
				page = await this.pagesRepository.findOneBy({ id: ps.pageId });
			} else if (ps.name && ps.username) {
				const author = await this.usersRepository.findOneBy({
					host: IsNull(),
					usernameLower: ps.username.toLowerCase(),
				});
				if (author) {
					page = await this.pagesRepository.findOneBy({
						name: ps.name,
						userId: author.id,
					});
				}
			}

			if (page == null) {
				throw new ApiError(meta.errors.noSuchPage);
			}

			return (await this.pageEntityService.pack(page, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
