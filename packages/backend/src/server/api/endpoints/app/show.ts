import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import { AppSchema } from '@/models/zod/AppSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = AppSchema;
export const meta = {
	tags: ['app'],
	errors: {
		noSuchApp: {
			message: 'No such app.',
			code: 'NO_SUCH_APP',
			id: 'dce83913-2dc6-4093-8a7b-71dbb11718a3',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	appId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly appEntityService: AppEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, user, token) => {
			const isSecure = user != null && token == null;

			// Lookup app
			const ap = await this.prismaService.client.app.findUnique({
				where: { id: ps.appId },
			});

			if (ap == null) {
				throw new ApiError(meta.errors.noSuchApp);
			}

			return (await this.appEntityService.pack(ap, user, {
				detail: true,
				includeSecret: isSecure && ap.userId === user.id,
			})) satisfies z.infer<typeof res>;
		});
	}
}
