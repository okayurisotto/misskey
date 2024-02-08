import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { FlashLikeEntityService } from '@/core/entities/FlashLikeEntityService.js';
import { FlashSchema } from '@/models/zod/FlashSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(
	z.object({
		id: z.string(),
		flash: FlashSchema,
	}),
);
export const meta = {
	tags: ['account', 'flash'],
	requireCredential: true,
	kind: 'read:flash-likes',
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
		private readonly flashLikeEntityService: FlashLikeEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const likes = await this.prismaService.client.flashLike.findMany({
				where: {
					AND: [paginationQuery.where, { userId: me.id }],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				likes.map((like) => this.flashLikeEntityService.pack(like, me)),
			);
		});
	}
}
