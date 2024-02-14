import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import {
	AppIsAuthorizedOnlySchema,
	AppLiteSchema,
} from '@/models/zod/AppSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';
import { EntityMap } from '@/misc/EntityMap.js';

const res = z.array(AppLiteSchema.merge(AppIsAuthorizedOnlySchema));
export const meta = {
	tags: ['account', 'app'],
	requireCredential: true,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	offset: z.number().int().default(0),
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
			const results = await this.prismaService.client.app.findMany({
				where: { userId: me.id },
				include: { accessTokens: { where: { userId: me.id } } },
				skip: ps.offset,
				take: ps.limit,
			});

			const data = {
				app: new EntityMap('id', results),
				access_token: new EntityMap(
					'id',
					results.flatMap(({ accessTokens }) => accessTokens),
				),
			};

			return results.map((result) => ({
				...this.appEntityService.packLite(result.id, data),
				...this.appEntityService.packAuthorizedOnly(result.id, me.id, data),
			}));
		});
	}
}
