import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AdSchema } from '@/models/zod/AdSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { AdEntityService } from '@/core/entities/AdEntityService.js';

const res = z.array(AdSchema);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z
	.object({ limit: limit({ max: 100, default: 10 }) })
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly adEntityService: AdEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const ads = await this.prismaService.client.ad.findMany({
				where: { AND: [paginationQuery.where] },
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return ads.map((ad) => this.adEntityService.pack(ad));
		});
	}
}
