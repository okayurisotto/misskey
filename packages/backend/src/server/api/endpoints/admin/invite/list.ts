import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { InviteCodeEntityService } from '@/core/entities/InviteCodeEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';
import type { Prisma } from '@prisma/client';

const res = z.array(z.unknown());
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 30 }),
	offset: z.number().int().default(0),
	type: z.enum(['unused', 'used', 'expired', 'all']).default('all'),
	sort: z.enum(['+createdAt', '-createdAt', '+usedAt', '-usedAt']).optional(),
});

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
	) {
		super(meta, paramDef, async (ps) => {
			const orderBy = ((): Prisma.InviteCodeOrderByWithRelationInput => {
				switch (ps.sort) {
					case '+createdAt':
						return { createdAt: 'desc' };
					case '-createdAt':
						return { createdAt: 'asc' };
					case '+usedAt':
						return { usedAt: { sort: 'desc', nulls: 'last' } };
					case '-usedAt':
						return { usedAt: { sort: 'asc', nulls: 'first' } };
					default:
						return { id: 'desc' };
				}
			})();

			const tickets = await this.prismaService.client.inviteCode.findMany({
				where: {
					AND: [
						ps.type === 'unused' ? { usedById: null } : {},
						ps.type === 'used' ? { usedById: { not: null } } : {},
						ps.type === 'expired' ? { expiresAt: { lt: new Date() } } : {},
					],
				},
				include: { createdBy: true, usedBy: true },
				orderBy,
				take: ps.limit,
				skip: ps.offset,
			});

			return await Promise.all(
				tickets.map((ticket) => this.inviteCodeEntityService.pack(ticket)),
			);
		});
	}
}
