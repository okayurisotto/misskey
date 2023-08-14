import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserSchema } from '@/models/zod/UserSchema.js';
import { LocalUsernameSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

const res = z.array(UserSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Search for users.',
	res,
} as const;

export const paramDef = z.object({
	query: z.string(),
	offset: z.number().int().default(0),
	limit: z.number().int().min(1).max(100).default(10),
	origin: z.enum(['local', 'remote', 'combined']).default('combined'),
	detail: z.boolean().default(true),
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
			const activeThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30日

			ps.query = ps.query.trim();
			const isUsername = ps.query.startsWith('@');

			let users: user[] = [];

			if (isUsername) {
				users = await this.prismaService.client.user.findMany({
					where: {
						AND: [
							{
								usernameLower: {
									startsWith: ps.query.replace('@', '').toLowerCase(),
									mode: 'insensitive',
								},
							},
							{ OR: [{ updatedAt: null }, { updatedAt: activeThreshold }] },
							{ isSuspended: false },
							ps.origin === 'local' ? { host: null } : {},
							ps.origin === 'remote' ? { host: { not: null } } : {},
						],
					},
					orderBy: { updatedAt: { sort: 'desc', nulls: 'last' } },
					take: ps.limit,
					skip: ps.offset,
				});
			} else {
				users = await this.prismaService.client.user.findMany({
					where: {
						AND: [
							{
								OR: [
									{ name: { contains: ps.query, mode: 'insensitive' } },
									LocalUsernameSchema.safeParse(ps.query).success
										? {
												usernameLower: {
													contains: ps.query.toLowerCase(),
													mode: 'insensitive',
												},
										  }
										: {}, // TODO
								],
							},
							{
								OR: [
									{ updatedAt: null },
									{ updatedAt: { gt: activeThreshold } },
								],
							},
							{ isSuspended: false },
							ps.origin === 'local' ? { host: null } : {},
							ps.origin === 'remote' ? { host: { not: null } } : {},
						],
					},
					orderBy: { updatedAt: { sort: 'desc', nulls: 'last' } },
					take: ps.limit,
					skip: ps.offset,
				});

				if (users.length < ps.limit) {
					const descriptionSearch =
						await this.prismaService.client.user.findMany({
							where: {
								AND: [
									{
										user_profile: {
											AND: [
												{
													description: {
														contains: ps.query,
														mode: 'insensitive',
													},
												},
												ps.origin === 'local' ? { userHost: null } : {},
												ps.origin === 'remote'
													? { userHost: { not: null } }
													: {},
											],
										},
									},
									{
										OR: [
											{ updatedAt: null },
											{ updatedAt: { gt: activeThreshold } },
										],
									},
									{ isSuspended: false },
								],
							},
							orderBy: { updatedAt: { sort: 'desc', nulls: 'last' } },
							take: ps.limit,
							skip: ps.offset,
						});

					users = users.concat(descriptionSearch);
				}
			}

			return (await Promise.all(
				users.map((user) =>
					this.userEntityService.pack(user, me, { detail: ps.detail }),
				),
			)) satisfies z.infer<typeof res>;
		});
	}
}
