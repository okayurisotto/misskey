import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository, FlashsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';
import { DI } from '@/di-symbols.js';
import { FlashSchema } from '@/models/zod/FlashSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = FlashSchema;
export const meta = {
	tags: ['flashs'],
	requireCredential: false,
	res,
	errors: {
		noSuchFlash: {
			message: 'No such flash.',
			code: 'NO_SUCH_FLASH',
			id: 'f0d34a1a-d29a-401d-90ba-1982122b5630',
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
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.flashsRepository)
		private flashsRepository: FlashsRepository,

		private flashEntityService: FlashEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const flash = await this.flashsRepository.findOneBy({ id: ps.flashId });

			if (flash == null) {
				throw new ApiError(meta.errors.noSuchFlash);
			}

			return (await this.flashEntityService.pack(flash, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
