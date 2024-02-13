import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RenoteMutingEntityService } from '@/core/entities/RenoteMutingEntityService.js';
import { RenoteMutingSchema } from '@/models/zod/RenoteMutingSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(RenoteMutingSchema);
export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'read:mutes',
	res,
} as const;

export const paramDef = z
	.object({ limit: limit({ max: 100, default: 30 }) })
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly renoteMutingEntityService: RenoteMutingEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const mutings = await this.prismaService.client.renoteMuting.findMany({
				where: { AND: [paginationQuery.where, { muterId: me.id }] },
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				mutings.map((muting) =>
					this.renoteMutingEntityService.pack(muting, me),
				),
			);
		});
	}
}
