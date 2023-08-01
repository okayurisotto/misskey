import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AdsRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchAd: {
			message: 'No such ad.',
			code: 'NO_SUCH_AD',
			id: 'ccac9863-3a03-416e-b899-8a64041118b1',
		},
	},
} as const;

const paramDef_ = z.object({
	id: misskeyIdPattern,
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
	) {
		super(meta, paramDef_, async (ps, me) => {
			const ad = await this.adsRepository.findOneBy({ id: ps.id });

			if (ad == null) throw new ApiError(meta.errors.noSuchAd);

			await this.adsRepository.delete(ad.id);
		});
	}
}
