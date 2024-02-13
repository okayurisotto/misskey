import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';
import type { Prisma } from '@prisma/client';
import { RoleUtilService } from '@/core/RoleUtilService.js';

const res = z.array(UserDetailedSchema);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
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
			'+lastActiveDate',
			'-lastActiveDate',
		])
		.optional(),
	state: z
		.enum([
			'all',
			'alive',
			'available',
			'admin',
			'moderator',
			'adminOrModerator',
			'suspended',
		])
		.default('all'),
	origin: z.enum(['combined', 'local', 'remote']).default('combined'),
	username: z.string().nullable().default(null),
	hostname: z.string().nullable().default(null),
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
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
		private readonly roleUtilService: RoleUtilService,
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
						return { updatedAt: { sort: 'desc', nulls: 'last' } };
					case '-updatedAt':
						return { updatedAt: { sort: 'asc', nulls: 'first' } };
					case '+lastActiveDate':
						return { lastActiveDate: { sort: 'desc', nulls: 'last' } };
					case '-lastActiveDate':
						return { lastActiveDate: { sort: 'asc', nulls: 'first' } };
					default:
						return { id: 'asc' };
				}
			})();

			const [adminFilter, moderatorFilter, adminAndModeratorFilter] =
				await Promise.all([
					(async (): Promise<Pick<Prisma.UserWhereInput, 'id'>> =>
						ps.state === 'admin'
							? { id: { in: await this.roleUtilService.getAdministratorIds() } }
							: {})(),
					(async (): Promise<Pick<Prisma.UserWhereInput, 'id'>> =>
						ps.state === 'moderator'
							? {
									id: { in: await this.roleUtilService.getModeratorIds(false) },
							  }
							: {})(),
					(async (): Promise<Pick<Prisma.UserWhereInput, 'id'>> =>
						ps.state === 'adminOrModerator'
							? { id: { in: await this.roleUtilService.getModeratorIds(true) } }
							: {})(),
				]);

			const users = await this.prismaService.client.user.findMany({
				where: {
					AND: [
						ps.state === 'available' ? { isSuspended: false } : {},
						ps.state === 'alive'
							? {
									updatedAt: {
										gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
									},
							  }
							: {},
						ps.state === 'suspended' ? { isSuspended: true } : {},
						adminFilter,
						moderatorFilter,
						adminAndModeratorFilter,
						ps.origin === 'local' ? { host: null } : {},
						ps.origin === 'remote' ? { host: { not: null } } : {},
						ps.username !== null
							? { usernameLower: { startsWith: ps.username.toLowerCase() } }
							: {},
						ps.hostname ? { host: ps.hostname.toLowerCase() } : {},
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
