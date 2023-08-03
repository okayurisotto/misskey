import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { FlashsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';
import { DI } from '@/di-symbols.js';
import { FlashSchema } from '@/models/zod/FlashSchema.js';

const res = z.array(FlashSchema);
export const meta = {
	tags: ['flash'],
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
		@Inject(DI.flashsRepository)
		private flashsRepository: FlashsRepository,

		private flashEntityService: FlashEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.flashsRepository
				.createQueryBuilder('flash')
				.andWhere('flash.likedCount > 0')
				.orderBy('flash.likedCount', 'DESC');

			const flashs = await query.limit(10).getMany();

			return (await Promise.all(
				flashs.map((flash) => this.flashEntityService.pack(flash, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
