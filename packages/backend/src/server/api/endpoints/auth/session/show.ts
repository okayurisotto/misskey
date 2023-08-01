import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AuthSessionsRepository } from '@/models/index.js';
import { AuthSessionEntityService } from '@/core/entities/AuthSessionEntityService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { AppSchema } from '@/models/zod/AppSchema.js';
import { ApiError } from '../../../error.js';

const res = z.object({
	id: misskeyIdPattern,
	app: AppSchema,
	token: z.string(),
});
export const meta = {
	tags: ['auth'],
	requireCredential: false,
	errors: {
		noSuchSession: {
			message: 'No such session.',
			code: 'NO_SUCH_SESSION',
			id: 'bd72c97d-eba7-4adb-a467-f171b8847250',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	token: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.authSessionsRepository)
		private authSessionsRepository: AuthSessionsRepository,

		private authSessionEntityService: AuthSessionEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Lookup session
			const session = await this.authSessionsRepository.findOneBy({
				token: ps.token,
			});

			if (session == null) {
				throw new ApiError(meta.errors.noSuchSession);
			}

			return (await this.authSessionEntityService.pack(
				session,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
