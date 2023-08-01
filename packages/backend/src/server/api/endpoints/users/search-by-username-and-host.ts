import { z } from 'zod';
import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository, FollowingsRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import type { User } from '@/models/entities/User.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { UserSchema } from '@/models/zod/UserSchema.js';

const res = z.array(UserSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Search for a user by username and/or host.',
	res,
} as const;

const paramDefBase = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	detail: z.boolean().default(true),
});
export const paramDef = z.union([
	paramDefBase.merge(z.object({ username: z.string().nullable() })),
	paramDefBase.merge(z.object({ host: z.string().nullable() })),
]);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const setUsernameAndHostQuery = (
				query = this.usersRepository.createQueryBuilder('user'),
			) => {
				if ('username' in ps && ps.username !== null) {
					query.andWhere('user.usernameLower LIKE :username', {
						username: sqlLikeEscape(ps.username.toLowerCase()) + '%',
					});
				}

				if ('host' in ps && ps.host !== null) {
					if (ps.host === this.config.hostname || ps.host === '.') {
						query.andWhere('user.host IS NULL');
					} else {
						query.andWhere('user.host LIKE :host', {
							host: sqlLikeEscape(ps.host.toLowerCase()) + '%',
						});
					}
				}

				return query;
			};

			const activeThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30日

			let users: User[] = [];

			if (me) {
				const followingQuery = this.followingsRepository
					.createQueryBuilder('following')
					.select('following.followeeId')
					.where('following.followerId = :followerId', { followerId: me.id });

				const query = setUsernameAndHostQuery()
					.andWhere(`user.id IN (${followingQuery.getQuery()})`)
					.andWhere('user.id != :meId', { meId: me.id })
					.andWhere('user.isSuspended = FALSE')
					.andWhere(
						new Brackets((qb) => {
							qb.where('user.updatedAt IS NULL').orWhere(
								'user.updatedAt > :activeThreshold',
								{ activeThreshold: activeThreshold },
							);
						}),
					);

				query.setParameters(followingQuery.getParameters());

				users = await query
					.orderBy('user.usernameLower', 'ASC')
					.limit(ps.limit)
					.getMany();

				if (users.length < ps.limit) {
					const otherQuery = setUsernameAndHostQuery()
						.andWhere(`user.id NOT IN (${followingQuery.getQuery()})`)
						.andWhere('user.isSuspended = FALSE')
						.andWhere('user.updatedAt IS NOT NULL');

					otherQuery.setParameters(followingQuery.getParameters());

					const otherUsers = await otherQuery
						.orderBy('user.updatedAt', 'DESC')
						.limit(ps.limit - users.length)
						.getMany();

					users = users.concat(otherUsers);
				}
			} else {
				const query = setUsernameAndHostQuery()
					.andWhere('user.isSuspended = FALSE')
					.andWhere('user.updatedAt IS NOT NULL');

				users = await query
					.orderBy('user.updatedAt', 'DESC')
					.limit(ps.limit - users.length)
					.getMany();
			}

			return (await this.userEntityService.packMany(users, me, {
				detail: !!ps.detail,
			})) satisfies z.infer<typeof res>;
		});
	}
}
