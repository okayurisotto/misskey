import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { PagesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../error.js';

export const meta = {
	requireCredential: true,
	secure: true,
	errors: {
		noSuchPage: {
			message: 'No such page.',
			code: 'NO_SUCH_PAGE',
			id: '4a13ad31-6729-46b4-b9af-e86b265c2e74',
		},
	},
} as const;

const paramDef_ = z.object({
	pageId: misskeyIdPattern,
	event: z.string(),
	var: z.unknown().optional(),
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

		private userEntityService: UserEntityService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const page = await this.pagesRepository.findOneBy({ id: ps.pageId });
			if (page == null) {
				throw new ApiError(meta.errors.noSuchPage);
			}

			this.globalEventService.publishMainStream(page.userId, 'pageEvent', {
				pageId: ps.pageId,
				event: ps.event,
				var: ps.var,
				userId: me.id,
				user: await this.userEntityService.pack(
					me.id,
					{ id: page.userId },
					{ detail: true },
				),
			});
		});
	}
}
