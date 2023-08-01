import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { UsersRepository } from '@/models/index.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';

const res = z.array(UserDetailedSchema);
export const meta = {
	requireCredential: false,
	tags: ['hashtags', 'users'],
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	tag: z.string(),
	limit: z.number().int().min(1).max(100).default(10),
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
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.usersRepository
				.createQueryBuilder('user')
				.where(':tag = ANY(user.tags)', { tag: normalizeForSearch(ps.tag) })
				.andWhere('user.isSuspended = FALSE');

			const recent = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);

			if (ps.state === 'alive') {
				query.andWhere('user.updatedAt > :date', { date: recent });
			}

			if (ps.origin === 'local') {
				query.andWhere('user.host IS NULL');
			} else if (ps.origin === 'remote') {
				query.andWhere('user.host IS NOT NULL');
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
					query.orderBy('user.updatedAt', 'DESC');
					break;
				case '-updatedAt':
					query.orderBy('user.updatedAt', 'ASC');
					break;
			}

			const users = await query.limit(ps.limit).getMany();

			return (await this.userEntityService.packMany(users, me, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
