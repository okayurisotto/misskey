import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { FlashsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['flashs'],
	requireCredential: true,
	kind: 'write:flash',
	errors: {
		noSuchFlash: {
			message: 'No such flash.',
			code: 'NO_SUCH_FLASH',
			id: 'de1623ef-bbb3-4289-a71e-14cfa83d9740',
		},
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '1036ad7b-9f92-4fff-89c3-0e50dc941704',
		},
	},
} as const;

const paramDef_ = z.object({
	flashId: misskeyIdPattern,
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
		@Inject(DI.flashsRepository)
		private flashsRepository: FlashsRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const flash = await this.flashsRepository.findOneBy({ id: ps.flashId });
			if (flash == null) {
				throw new ApiError(meta.errors.noSuchFlash);
			}
			if (flash.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			await this.flashsRepository.delete(flash.id);
		});
	}
}
