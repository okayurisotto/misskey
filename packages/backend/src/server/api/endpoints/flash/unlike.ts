import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { FlashsRepository, FlashLikesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['flash'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:flash-likes',
	errors: {
		noSuchFlash: {
			message: 'No such flash.',
			code: 'NO_SUCH_FLASH',
			id: 'afe8424a-a69e-432d-a5f2-2f0740c62410',
		},

		notLiked: {
			message: 'You have not liked that flash.',
			code: 'NOT_LIKED',
			id: '755f25a7-9871-4f65-9f34-51eaad9ae0ac',
		},
	},
} as const;

export const paramDef = z.object({
	flashId: misskeyIdPattern,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.flashsRepository)
		private flashsRepository: FlashsRepository,

		@Inject(DI.flashLikesRepository)
		private flashLikesRepository: FlashLikesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const flash = await this.flashsRepository.findOneBy({ id: ps.flashId });
			if (flash == null) {
				throw new ApiError(meta.errors.noSuchFlash);
			}

			const exist = await this.flashLikesRepository.findOneBy({
				flashId: flash.id,
				userId: me.id,
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notLiked);
			}

			// Delete like
			await this.flashLikesRepository.delete(exist.id);

			this.flashsRepository.decrement({ id: flash.id }, 'likedCount', 1);
		});
	}
}
