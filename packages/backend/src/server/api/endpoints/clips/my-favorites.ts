import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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
		@Inject(DI.clipFavoritesRepository)
		private clipFavoritesRepository: ClipFavoritesRepository,

		private clipEntityService: ClipEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
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
