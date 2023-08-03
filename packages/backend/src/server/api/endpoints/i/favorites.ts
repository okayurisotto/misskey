import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { NoteFavoritesRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteFavoriteEntityService } from '@/core/entities/NoteFavoriteEntityService.js';
import { DI } from '@/di-symbols.js';
import { NoteFavoriteSchema } from '@/models/zod/NoteFavoriteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(NoteFavoriteSchema);
export const meta = {
	tags: ['account', 'notes', 'favorites'],
	requireCredential: true,
	kind: 'read:favorites',
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(60).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.noteFavoritesRepository)
		private noteFavoritesRepository: NoteFavoritesRepository,

		private noteFavoriteEntityService: NoteFavoriteEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.noteFavoritesRepository.createQueryBuilder('favorite'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('favorite.userId = :meId', { meId: me.id })
				.leftJoinAndSelect('favorite.note', 'note');

			const favorites = await query.limit(ps.limit).getMany();

			return (await Promise.all(
				favorites.map((favorite) =>
					this.noteFavoriteEntityService.pack(favorite, me),
				),
			)) satisfies z.infer<typeof res>;
		});
	}
}
