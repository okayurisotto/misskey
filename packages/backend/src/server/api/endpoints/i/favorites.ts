import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { NoteFavoritesRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteFavoriteEntityService } from '@/core/entities/NoteFavoriteEntityService.js';
import { DI } from '@/di-symbols.js';
import { NoteFavoriteSchema } from '@/models/zod/NoteFavoriteSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(NoteFavoriteSchema);
export const meta = {
	tags: ['account', 'notes', 'favorites'],
	requireCredential: true,
	kind: 'read:favorites',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(60).default(10),
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
		@Inject(DI.noteFavoritesRepository)
		private noteFavoritesRepository: NoteFavoritesRepository,

		private noteFavoriteEntityService: NoteFavoriteEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.noteFavoritesRepository.createQueryBuilder('favorite'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('favorite.userId = :meId', { meId: me.id })
				.leftJoinAndSelect('favorite.note', 'note');

			const favorites = await query.limit(ps.limit).getMany();

			return (await this.noteFavoriteEntityService.packMany(
				favorites,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
