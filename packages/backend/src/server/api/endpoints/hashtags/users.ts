import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';
import type { Prisma } from '@prisma/client';

const res = z.array(UserDetailedSchema);
export const meta = {
	requireCredential: false,
	tags: ['hashtags', 'users'],
	res,
} as const;

export const paramDef = z.object({
	tag: z.string(),
	limit: limit({ max: 100, default: 10 }),
	sort: z.enum([
		'+follower',
		'-follower',
		'+createdAt',
		'-createdAt',
		'+updatedAt',
		'-updatedAt',
	]),
	state: z.enum(['all', 'alive']).default('all'),
	origin: z.enum(['combined', 'local', 'remote']).default('local'),
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
	) {
		super(meta, paramDef, async (ps, me) => {
			const recent = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);

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
				}
			})();

			const users = await this.prismaService.client.user.findMany({
				where: {
					AND: [
						{ tags: { has: normalizeForSearch(ps.tag) } },
						{ isSuspended: false },
						ps.state === 'alive' ? { updatedAt: recent } : {},
						ps.origin === 'local' ? { host: null } : {},
						ps.origin === 'remote' ? { host: { not: null } } : {},
					],
				},
				orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				users.map((user) => this.userEntityService.packDetailed(user, me)),
			);
		});
	}
}
