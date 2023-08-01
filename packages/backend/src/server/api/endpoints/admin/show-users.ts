import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { RoleService } from '@/core/RoleService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';

const res = z.array(UserDetailedSchema);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
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
		.default('all')
		.optional(),
	origin: z
		.enum(['combined', 'local', 'remote'])
		.default('combined')
		.optional(),
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
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private userEntityService: UserEntityService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.usersRepository.createQueryBuilder('user');

			switch (ps.state) {
				case 'available':
					query.where('user.isSuspended = FALSE');
					break;
				case 'alive':
					query.where('user.updatedAt > :date', {
						date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
					});
					break;
				case 'suspended':
					query.where('user.isSuspended = TRUE');
					break;
				case 'admin': {
					const adminIds = await this.roleService.getAdministratorIds();
					if (adminIds.length === 0) return [];
					query.where('user.id IN (:...adminIds)', { adminIds: adminIds });
					break;
				}
				case 'moderator': {
					const moderatorIds = await this.roleService.getModeratorIds(false);
					if (moderatorIds.length === 0) return [];
					query.where('user.id IN (:...moderatorIds)', {
						moderatorIds: moderatorIds,
					});
					break;
				}
				case 'adminOrModerator': {
					const adminOrModeratorIds = await this.roleService.getModeratorIds();
					if (adminOrModeratorIds.length === 0) return [];
					query.where('user.id IN (:...adminOrModeratorIds)', {
						adminOrModeratorIds: adminOrModeratorIds,
					});
					break;
				}
			}

			switch (ps.origin) {
				case 'local':
					query.andWhere('user.host IS NULL');
					break;
				case 'remote':
					query.andWhere('user.host IS NOT NULL');
					break;
			}

			if (ps.username) {
				query.andWhere('user.usernameLower like :username', {
					username: sqlLikeEscape(ps.username.toLowerCase()) + '%',
				});
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
					query.orderBy('user.updatedAt', 'DESC', 'NULLS LAST');
					break;
				case '-updatedAt':
					query.orderBy('user.updatedAt', 'ASC', 'NULLS FIRST');
					break;
				case '+lastActiveDate':
					query.orderBy('user.lastActiveDate', 'DESC', 'NULLS LAST');
					break;
				case '-lastActiveDate':
					query.orderBy('user.lastActiveDate', 'ASC', 'NULLS FIRST');
					break;
				default:
					query.orderBy('user.id', 'ASC');
					break;
			}

			query.limit(ps.limit);
			query.offset(ps.offset);

			const users = await query.getMany();

			return (await this.userEntityService.packMany(users, me, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
