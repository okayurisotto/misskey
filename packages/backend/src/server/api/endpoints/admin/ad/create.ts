import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AdsRepository } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

const paramDef_ = z.object({
	url: z.string().min(1),
	memo: z.string(),
	place: z.string(),
	priority: z.string(),
	ratio: z.number().int(),
	expiresAt: z.number().int(),
	startsAt: z.number().int(),
	imageUrl: z.string().min(1),
	dayOfWeek: z.number().int(),
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
		@Inject(DI.adsRepository)
		private adsRepository: AdsRepository,

		private idService: IdService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			await this.adsRepository.insert({
				id: this.idService.genId(),
				createdAt: new Date(),
				expiresAt: new Date(ps.expiresAt),
				startsAt: new Date(ps.startsAt),
				dayOfWeek: ps.dayOfWeek,
				url: ps.url,
				imageUrl: ps.imageUrl,
				priority: ps.priority,
				ratio: ps.ratio,
				place: ps.place,
				memo: ps.memo,
			});
		});
	}
}
