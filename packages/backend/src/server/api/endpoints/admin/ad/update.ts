import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AdsRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchAd: {
			message: 'No such ad.',
			code: 'NO_SUCH_AD',
			id: 'b7aa1727-1354-47bc-a182-3a9c3973d300',
		},
	},
} as const;

export const paramDef = z.object({
	id: MisskeyIdSchema,
	memo: z.string(),
	url: z.string().min(1),
	imageUrl: z.string().min(1),
	place: z.string(),
	priority: z.string(),
	ratio: z.number().int(),
	expiresAt: z.number().int(),
	startsAt: z.number().int(),
	dayOfWeek: z.number().int(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.adsRepository)
		private adsRepository: AdsRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const ad = await this.adsRepository.findOneBy({ id: ps.id });

			if (ad == null) throw new ApiError(meta.errors.noSuchAd);

			await this.adsRepository.update(ad.id, {
				url: ps.url,
				place: ps.place,
				priority: ps.priority,
				ratio: ps.ratio,
				memo: ps.memo,
				imageUrl: ps.imageUrl,
				expiresAt: new Date(ps.expiresAt),
				startsAt: new Date(ps.startsAt),
				dayOfWeek: ps.dayOfWeek,
			});
		});
	}
}
