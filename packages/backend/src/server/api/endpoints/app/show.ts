import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchApp } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import {
	AppIsAuthorizedOnlySchema,
	AppLiteSchema,
	AppSecretOnlySchema,
} from '@/models/zod/AppSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { ApiError } from '../../error.js';

const res = z.union([
	AppLiteSchema,
	AppLiteSchema.merge(AppIsAuthorizedOnlySchema),
	AppLiteSchema.merge(AppIsAuthorizedOnlySchema).merge(AppSecretOnlySchema),
]);
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

			if (user === null) {
				const app = await this.prismaService.client.app.findUnique({
					where: { id: ps.appId },
				});

				if (app === null) {
					throw new ApiError(meta.errors.noSuchApp);
				}

				const data = {
					app: new EntityMap('id', [app]),
				};

				return this.appEntityService.packLite(app.id, data);
			} else {
				const app = await this.prismaService.client.app.findUnique({
					where: { id: ps.appId },
					include: { access_token: { where: { userId: user.id } } },
				});

				if (app === null) {
					throw new ApiError(meta.errors.noSuchApp);
				}

				const data = {
					app: new EntityMap('id', [app]),
					access_token: new EntityMap('id', app.access_token),
				};

				const includeSecret = isSecure && app.userId === user.id;

				if (includeSecret) {
					return {
						...this.appEntityService.packLite(app.id, data),
						...this.appEntityService.packAuthorizedOnly(app.id, user.id, data),
						...this.appEntityService.packSecretOnly(app.id, data),
					};
				} else {
					return {
						...this.appEntityService.packLite(app.id, data),
						...this.appEntityService.packAuthorizedOnly(app.id, user.id, data),
					};
				}
			}
		});
	}
}
