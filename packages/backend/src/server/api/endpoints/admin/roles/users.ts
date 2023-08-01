import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import type {
	RoleAssignmentsRepository,
	RolesRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = z.unknown(); // TODO
export const meta = {
	tags: ['admin', 'role', 'users'],
	requireCredential: false,
	requireAdmin: true,
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: '224eff5e-2488-4b18-b3e7-f50d94421648',
		},
	},
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	roleId: misskeyIdPattern,
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
		@Inject(DI.rolesRepository)
		private rolesRepository: RolesRepository,

		@Inject(DI.roleAssignmentsRepository)
		private roleAssignmentsRepository: RoleAssignmentsRepository,

		private queryService: QueryService,
		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const role = await this.rolesRepository.findOneBy({
				id: ps.roleId,
			});

			if (role == null) {
				throw new ApiError(meta.errors.noSuchRole);
			}

			const query = this.queryService
				.makePaginationQuery(
					this.roleAssignmentsRepository.createQueryBuilder('assign'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('assign.roleId = :roleId', { roleId: role.id })
				.andWhere(
					new Brackets((qb) => {
						qb.where('assign.expiresAt IS NULL').orWhere(
							'assign.expiresAt > :now',
							{ now: new Date() },
						);
					}),
				)
				.innerJoinAndSelect('assign.user', 'user');

			const assigns = await query.limit(ps.limit).getMany();

			return (await Promise.all(
				assigns.map(async (assign) => ({
					id: assign.id,
					createdAt: assign.createdAt,
					user: await this.userEntityService.pack(assign.user!, me, {
						detail: true,
					}),
					expiresAt: assign.expiresAt,
				})),
			)) satisfies z.infer<typeof res>;
		});
	}
}
