import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository, FollowingsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';

const res = z.array(UserDetailedSchema);
export const meta = {
	tags: ['users'],
	requireCredential: true,
	kind: 'read:account',
	description:
		'Show users that the authenticated user might be interested to follow.',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	offset: z.number().int().default(0),
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

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private userEntityService: UserEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.usersRepository
				.createQueryBuilder('user')
				.where('user.isLocked = FALSE')
				.andWhere('user.isExplorable = TRUE')
				.andWhere('user.host IS NULL')
				.andWhere('user.updatedAt >= :date', {
					date: new Date(Date.now() - ms('7days')),
				})
				.andWhere('user.id != :meId', { meId: me.id })
				.orderBy('user.followersCount', 'DESC');

			this.queryService.generateMutedUserQueryForUsers(query, me);
			this.queryService.generateBlockQueryForUsers(query, me);
			this.queryService.generateBlockedUserQuery(query, me);

			const followingQuery = this.followingsRepository
				.createQueryBuilder('following')
				.select('following.followeeId')
				.where('following.followerId = :followerId', { followerId: me.id });

			query.andWhere(`user.id NOT IN (${followingQuery.getQuery()})`);

			query.setParameters(followingQuery.getParameters());

			const users = await query.limit(ps.limit).offset(ps.offset).getMany();

			return (await this.userEntityService.packMany(users, me, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
