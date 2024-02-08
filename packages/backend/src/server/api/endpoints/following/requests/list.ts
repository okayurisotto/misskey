import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { FollowRequestEntityService } from '@/core/entities/FollowRequestEntityService.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(
	z.object({
		id: MisskeyIdSchema,
		follower: UserLiteSchema,
		followee: UserLiteSchema,
	}),
);
export const meta = {
	tags: ['following', 'account'],
	requireCredential: true,
	kind: 'read:following',
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
		private readonly followRequestEntityService: FollowRequestEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const requests = await this.prismaService.client.followRequest.findMany({
				where: { AND: [paginationQuery.where, { followeeId: me.id }] },
				take: ps.limit,
			});

			return await Promise.all(
				requests.map((req) => this.followRequestEntityService.pack(req)),
			);
		});
	}
}
