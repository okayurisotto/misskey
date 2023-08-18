import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { BlockingEntityService } from '@/core/entities/BlockingEntityService.js';
import { BlockingSchema } from '@/models/zod/BlockingSchema.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(BlockingSchema);
export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'read:blocks',
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 30 }),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly blockingEntityService: BlockingEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});
			const blockings = await this.prismaService.client.blocking.findMany({
				where: { AND: [paginationQuery.where, { blockerId: me.id }] },
				take: ps.limit,
				orderBy: { blockeeId: 'desc' },
			});

			return await Promise.all(
				blockings.map((blocking) =>
					this.blockingEntityService.pack(blocking, me),
				),
			);
		});
	}
}
