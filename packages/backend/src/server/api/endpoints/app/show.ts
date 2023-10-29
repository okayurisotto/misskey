import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchApp } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import { AppSchema } from '@/models/zod/AppSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = AppSchema;
export const meta = {
	tags: ['app'],
	errors: { noSuchApp: noSuchApp },
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
			const isSecure = user !== null && token === null;

			const app = await this.prismaService.client.app.findUnique({
				where: { id: ps.appId },
			});

			if (app === null) {
				throw new ApiError(meta.errors.noSuchApp);
			}

			return await this.appEntityService.pack(app, user, {
				includeSecret: isSecure && app.userId === user.id,
			});
		});
	}
}
