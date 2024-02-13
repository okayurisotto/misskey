import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { limit } from '@/models/zod/misc.js';
import type { Prisma } from '@prisma/client';

const res = z.array(UserDetailedSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	offset: z.number().int().default(0),
	sort: z
		.enum([
			'+follower',
			'-follower',
			'+createdAt',
			'-createdAt',
			'+updatedAt',
			'-updatedAt',
		])
		.optional(),
	state: z.enum(['all', 'alive']).default('all'),
	origin: z.enum(['combined', 'local', 'remote']).default('local'),
	hostname: z
		.string()
		.nullable()
		.default(null)
		.describe('The local host is represented with `null`.'),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const orderBy = ((): Prisma.UserOrderByWithRelationInput => {
				switch (ps.sort) {
					case '+follower':
						return { followersCount: 'desc' };
					case '-follower':
						return { followersCount: 'asc' };
					case '+createdAt':
						return { createdAt: 'desc' };
					case '-createdAt':
						return { createdAt: 'asc' };
					case '+updatedAt':
						return { updatedAt: 'desc' };
					case '-updatedAt':
						return { updatedAt: 'asc' };
					default:
						return { id: 'asc' };
				}
			})();

			const users = await this.prismaService.client.user.findMany({
				where: {
					AND: [
						{ isExplorable: true },
						{ isSuspended: false },
						ps.state === 'alive'
							? {
									updatedAt: {
										gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
									},
							  }
							: {},
						ps.origin === 'local' ? { host: null } : {},
						ps.origin === 'remote' ? { host: { not: null } } : {},
						ps.hostname ? { host: ps.hostname.toLowerCase() } : {},
						ps.sort === '+updatedAt' ? { updatedAt: { not: null } } : {},
						ps.sort === '-updatedAt' ? { updatedAt: { not: null } } : {},
						...(me
							? [
									this.prismaQueryService.getMutingWhereForUser(me.id),
									this.prismaQueryService.getBlockedWhereForUser(me.id),
							  ]
							: []),
					],
				},
				orderBy,
				take: ps.limit,
				skip: ps.offset,
			});

			return await Promise.all(
				users.map((user) => this.userEntityService.packDetailed(user, me)),
			);
		});
	}
}
