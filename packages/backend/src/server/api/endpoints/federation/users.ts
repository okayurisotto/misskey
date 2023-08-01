import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { UsersRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(UserDetailedNotMeSchema);
export const meta = {
	tags: ['federation'],
	requireCredential: false,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	host: z.string(),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
	limit: z.number().int().min(1).max(100).default(10),
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
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.usersRepository.createQueryBuilder('user'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('user.host = :host', { host: ps.host });

			const users = await query.limit(ps.limit).getMany();

			return (await this.userEntityService.packMany(users, me, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
