import { z } from 'zod';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import type { FlashsRepository, DriveFilesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['flash'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:flash',
	limit: {
		duration: ms('1hour'),
		max: 300,
	},
	errors: {
		noSuchFlash: {
			message: 'No such flash.',
			code: 'NO_SUCH_FLASH',
			id: '611e13d2-309e-419a-a5e4-e0422da39b02',
		},
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '08e60c88-5948-478e-a132-02ec701d67b2',
		},
	},
} as const;

export const paramDef = z.object({
	flashId: misskeyIdPattern,
	title: z.string(),
	summary: z.string(),
	script: z.string(),
	permissions: z.array(z.string()),
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

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const flash = await this.flashsRepository.findOneBy({ id: ps.flashId });
			if (flash == null) {
				throw new ApiError(meta.errors.noSuchFlash);
			}
			if (flash.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			await this.flashsRepository.update(flash.id, {
				updatedAt: new Date(),
				title: ps.title,
				summary: ps.summary,
				script: ps.script,
				permissions: ps.permissions,
			});
		});
	}
}
