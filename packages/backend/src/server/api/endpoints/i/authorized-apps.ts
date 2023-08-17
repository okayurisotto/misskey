import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';

const res = z.array(z.unknown());
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
			// Get tokens
			const tokens = await this.prismaService.client.access_token.findMany({
				where: {
					userId: me.id,
					appId: { not: null },
				},
				take: ps.limit,
				skip: ps.offset,
				orderBy: { id: ps.sort === 'asc' ? 'asc' : 'desc' },
			});

			return (await Promise.all(
				tokens.map((token) =>
					this.appEntityService.pack(token.appId!, me, {
						detail: true,
					}),
				),
			)) satisfies z.infer<typeof res>;
		});
	}
}
