import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { InviteCodeEntityService } from '@/core/entities/InviteCodeEntityService.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(z.unknown());
export const meta = {
	tags: ['meta'],
	requireCredential: true,
	requireRolePolicy: 'canInvite',
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
		private readonly inviteCodeEntityService: InviteCodeEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const tickets =
				await this.prismaService.client.inviteCode.findMany({
					where: {
						AND: [paginationQuery.where, { createdById: me.id }],
					},
					orderBy: paginationQuery.orderBy,
					take: ps.limit,
				});

			return await Promise.all(
				tickets.map((ticket) => this.inviteCodeEntityService.pack(ticket, me)),
			);
		});
	}
}
