import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { ClipFavoritesRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';

const res = z.array(ClipSchema);
export const meta = {
	tags: ['account', 'clip'],
	requireCredential: true,
	kind: 'read:clip-favorite',
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
		@Inject(DI.clipFavoritesRepository)
		private clipFavoritesRepository: ClipFavoritesRepository,

		private clipEntityService: ClipEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.clipFavoritesRepository
				.createQueryBuilder('favorite')
				.andWhere('favorite.userId = :meId', { meId: me.id })
				.leftJoinAndSelect('favorite.clip', 'clip');

			const favorites = await query.getMany();

			return (await this.clipEntityService.packMany(
				favorites.map((x) => x.clip!),
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
