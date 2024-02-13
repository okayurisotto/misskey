import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';
import { EntityMap } from '@/misc/EntityMap.js';
import {
	AppIsAuthorizedOnlySchema,
	AppLiteSchema,
} from '@/models/zod/AppSchema.js';

const res = z.array(AppLiteSchema.merge(AppIsAuthorizedOnlySchema));
export const meta = {
	requireCredential: true,
	secure: true,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	offset: z.number().int().default(0),
	sort: z.enum(['desc', 'asc']).default('desc'),
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
		super(meta, paramDef, async (ps, me) => {
			const results = await this.prismaService.client.accessToken.findMany({
				where: { userId: me.id },
				include: { app: true },
				distinct: ['appId'],
				orderBy: { app: { id: ps.sort === 'asc' ? 'asc' : 'desc' } },
				skip: ps.offset,
				take: ps.limit,
			});

			const data = {
				app: new EntityMap(
					'id',
					results.map(({ app }) => app),
				),
				access_token: new EntityMap('id', results),
			};

			return results.map((result) => {
				if (result.app === null) throw new Error();
				return {
					...this.appEntityService.packLite(result.app.id, data),
					...this.appEntityService.packAuthorizedOnly(
						result.app.id,
						me.id,
						data,
					),
				};
			});
		});
	}
}
