import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserSchema } from '@/models/zod/UserSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { Prisma, user } from '@prisma/client';

const res = z.array(UserSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Search for a user by username and/or host.',
	res,
} as const;

const paramDef_base = z.object({
	limit: limit({ max: 100, default: 10 }),
	detail: z.boolean().default(true),
});
export const paramDef = z.union([
	paramDef_base.merge(z.object({ username: z.string().nullable() })),
	paramDef_base.merge(z.object({ host: z.string().nullable() })),
]);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private configLoaderService: ConfigLoaderService,

		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const activeThreshold = new Date(Date.now() - ms('30days'));

			const where: Prisma.userWhereInput = {
				AND: [
					'username' in ps && ps.username !== null
						? {
								username: {
									startsWith: ps.username.toLowerCase(),
									mode: 'insensitive',
								},
						  }
						: {},
					'host' in ps && ps.host !== null
						? ps.host === this.configLoaderService.data.hostname ||
						  ps.host === '.'
							? { host: null }
							: { host: { startsWith: ps.host.toLowerCase() } }
						: {},
				],
			};

			let users: user[];

			if (me) {
				users = await this.prismaService.client.user.findMany({
					where: {
						AND: [
							where,
							{
								following_following_followeeIdTouser: {
									some: { followerId: me.id },
								},
								id: { not: me.id },
								isSuspended: false,
								OR: [
									{ updatedAt: null },
									{ updatedAt: { gt: activeThreshold } },
								],
							},
						],
					},
					orderBy: { usernameLower: 'asc' },
					take: ps.limit,
				});

				if (users.length < ps.limit) {
					const otherUsers = await this.prismaService.client.user.findMany({
						where: {
							AND: [
								where,
								{
									following_following_followeeIdTouser: {
										none: { followerId: me.id },
									},
									isSuspended: false,
									updatedAt: { not: null },
								},
							],
						},
						orderBy: { updatedAt: 'desc' },
						take: ps.limit - users.length,
					});

					users = users.concat(otherUsers);
				}
			} else {
				users = await this.prismaService.client.user.findMany({
					where: {
						AND: [where, { isSuspended: false, updatedAt: { not: null } }],
					},
					orderBy: { updatedAt: 'desc' },
					take: ps.limit,
				});
			}

			return await Promise.all(
				users.map((user) => {
					if (ps.detail) {
						return this.userEntityService.packDetailed(user, me);
					} else {
						return this.userEntityService.packLite(user);
					}
				}),
			);
		});
	}
}
