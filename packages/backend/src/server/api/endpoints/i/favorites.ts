import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteFavoriteEntityService } from '@/core/entities/NoteFavoriteEntityService.js';
import { NoteFavoriteSchema } from '@/models/zod/NoteFavoriteSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteFavoriteSchema);
export const meta = {
	tags: ['account', 'notes', 'favorites'],
	requireCredential: true,
	kind: 'read:favorites',
	res,
} as const;

export const paramDef = z
	.object({ limit: limit({ max: 60, default: 10 }) })
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly noteFavoriteEntityService: NoteFavoriteEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const favorites = await this.prismaService.client.noteFavorite.findMany({
				where: { AND: [paginationQuery.where, { userId: me.id }] },
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				favorites.map((favorite) =>
					this.noteFavoriteEntityService.pack(favorite, me),
				),
			);
		});
	}
}
