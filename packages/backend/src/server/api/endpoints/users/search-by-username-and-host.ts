import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserSchema } from '@/models/zod/UserSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { UserEntityPackLiteService } from '@/core/entities/UserEntityPackLiteService.js';
import type { Prisma, User } from '@prisma/client';

const res = z.array(UserSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Search for a user by username and/or host.',
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	detail: z.boolean().default(true),
	username: z.string().nullish(),
	host: z
		.string()
		.nullish()
		.transform((v) => (v === '' ? null : v))
		.transform((v) => (v === '.' ? null : v)),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
		private readonly userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const activeThreshold = new Date(Date.now() - ms('30days'));

			const where: Prisma.UserWhereInput = {
				AND: [
					'username' in ps && ps.username != null
						? {
								username: {
									startsWith: ps.username.toLowerCase(),
									mode: 'insensitive',
								},
						  }
						: {},
					'host' in ps && ps.host != null
						? ps.host === this.configLoaderService.data.hostname
							? { host: null }
							: { host: { startsWith: ps.host.toLowerCase() } }
						: {},
				],
			};

			let users: User[];

			if (me) {
				users = await this.prismaService.client.user.findMany({
					where: {
						AND: [
							where,
							{
								followings_followee: {
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
									followings_followee: {
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
						return this.userEntityPackLiteService.packLite(user);
					}
				}),
			);
		});
	}
}
