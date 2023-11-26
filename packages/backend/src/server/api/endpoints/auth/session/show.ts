import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchSession_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AuthSessionEntityService } from '@/core/entities/AuthSessionEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { AppSchema } from '@/models/zod/AppSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = z.object({
	id: MisskeyIdSchema,
	app: AppSchema,
	token: z.string(),
});
export const meta = {
	tags: ['auth'],
	requireCredential: false,
	errors: { noSuchSession: noSuchSession_ },
	res,
} as const;

export const paramDef = z.object({ token: z.string() });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly authSessionEntityService: AuthSessionEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const session = await this.prismaService.client.authSession.findFirst({
				where: { token: ps.token },
			});

			if (session === null) {
				throw new ApiError(meta.errors.noSuchSession);
			}

			return await this.authSessionEntityService.pack(session, me);
		});
	}
}
