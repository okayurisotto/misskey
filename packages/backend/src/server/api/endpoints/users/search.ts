import { z } from 'zod';
import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type {
	UsersRepository,
	UserProfilesRepository,
} from '@/models/index.js';
import type { User } from '@/models/entities/User.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { UserSchema } from '@/models/zod/UserSchema.js';
import { LocalUsernameSchema } from '@/models/zod/misc.js';

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
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const activeThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30日

			ps.query = ps.query.trim();
			const isUsername = ps.query.startsWith('@');

			let users: User[] = [];

			if (isUsername) {
				const usernameQuery = this.usersRepository
					.createQueryBuilder('user')
					.where('user.usernameLower LIKE :username', {
						username:
							sqlLikeEscape(ps.query.replace('@', '').toLowerCase()) + '%',
					})
					.andWhere(
						new Brackets((qb) => {
							qb.where('user.updatedAt IS NULL').orWhere(
								'user.updatedAt > :activeThreshold',
								{ activeThreshold: activeThreshold },
							);
						}),
					)
					.andWhere('user.isSuspended = FALSE');

				if (ps.origin === 'local') {
					usernameQuery.andWhere('user.host IS NULL');
				} else if (ps.origin === 'remote') {
					usernameQuery.andWhere('user.host IS NOT NULL');
				}

				users = await usernameQuery
					.orderBy('user.updatedAt', 'DESC', 'NULLS LAST')
					.limit(ps.limit)
					.offset(ps.offset)
					.getMany();
			} else {
				const nameQuery = this.usersRepository
					.createQueryBuilder('user')
					.where(
						new Brackets((qb) => {
							qb.where('user.name ILIKE :query', {
								query: '%' + sqlLikeEscape(ps.query) + '%',
							});

							// Also search username if it qualifies as username
							if (LocalUsernameSchema.safeParse(ps.query).success) {
								qb.orWhere('user.usernameLower LIKE :username', {
									username: '%' + sqlLikeEscape(ps.query.toLowerCase()) + '%',
								});
							}
						}),
					)
					.andWhere(
						new Brackets((qb) => {
							qb.where('user.updatedAt IS NULL').orWhere(
								'user.updatedAt > :activeThreshold',
								{ activeThreshold: activeThreshold },
							);
						}),
					)
					.andWhere('user.isSuspended = FALSE');

				if (ps.origin === 'local') {
					nameQuery.andWhere('user.host IS NULL');
				} else if (ps.origin === 'remote') {
					nameQuery.andWhere('user.host IS NOT NULL');
				}

				users = await nameQuery
					.orderBy('user.updatedAt', 'DESC', 'NULLS LAST')
					.limit(ps.limit)
					.offset(ps.offset)
					.getMany();

				if (users.length < ps.limit) {
					const profQuery = this.userProfilesRepository
						.createQueryBuilder('prof')
						.select('prof.userId')
						.where('prof.description ILIKE :query', {
							query: '%' + sqlLikeEscape(ps.query) + '%',
						});

					if (ps.origin === 'local') {
						profQuery.andWhere('prof.userHost IS NULL');
					} else if (ps.origin === 'remote') {
						profQuery.andWhere('prof.userHost IS NOT NULL');
					}

					const query = this.usersRepository
						.createQueryBuilder('user')
						.where(`user.id IN (${profQuery.getQuery()})`)
						.andWhere(
							new Brackets((qb) => {
								qb.where('user.updatedAt IS NULL').orWhere(
									'user.updatedAt > :activeThreshold',
									{ activeThreshold: activeThreshold },
								);
							}),
						)
						.andWhere('user.isSuspended = FALSE')
						.setParameters(profQuery.getParameters());

					users = users.concat(
						await query
							.orderBy('user.updatedAt', 'DESC', 'NULLS LAST')
							.limit(ps.limit)
							.offset(ps.offset)
							.getMany(),
					);
				}
			}

			return (await Promise.all(
				users.map((user) => this.userEntityService.pack(user, me, { detail: ps.detail }))
			)) satisfies z.infer<typeof res>;
		});
	}
}
