import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';

const res = z.array(UserDetailedSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(10),
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
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private userEntityService: UserEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.usersRepository
				.createQueryBuilder('user')
				.where('user.isExplorable = TRUE')
				.andWhere('user.isSuspended = FALSE');

			switch (ps.state) {
				case 'alive':
					query.andWhere('user.updatedAt > :date', {
						date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
					});
					break;
			}

			switch (ps.origin) {
				case 'local':
					query.andWhere('user.host IS NULL');
					break;
				case 'remote':
					query.andWhere('user.host IS NOT NULL');
					break;
			}

			if (ps.hostname) {
				query.andWhere('user.host = :hostname', {
					hostname: ps.hostname.toLowerCase(),
				});
			}

			switch (ps.sort) {
				case '+follower':
					query.orderBy('user.followersCount', 'DESC');
					break;
				case '-follower':
					query.orderBy('user.followersCount', 'ASC');
					break;
				case '+createdAt':
					query.orderBy('user.createdAt', 'DESC');
					break;
				case '-createdAt':
					query.orderBy('user.createdAt', 'ASC');
					break;
				case '+updatedAt':
					query
						.andWhere('user.updatedAt IS NOT NULL')
						.orderBy('user.updatedAt', 'DESC');
					break;
				case '-updatedAt':
					query
						.andWhere('user.updatedAt IS NOT NULL')
						.orderBy('user.updatedAt', 'ASC');
					break;
				default:
					query.orderBy('user.id', 'ASC');
					break;
			}

			if (me) this.queryService.generateMutedUserQueryForUsers(query, me);
			if (me) this.queryService.generateBlockQueryForUsers(query, me);

			query.limit(ps.limit);
			query.offset(ps.offset);

			const users = await query.getMany();

			return (await this.userEntityService.packMany(users, me, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
