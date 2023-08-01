import { z } from 'zod';
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
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.unknown();
export const meta = {
	tags: ['role', 'users'],
	requireCredential: false,
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: '30aaaee3-4792-48dc-ab0d-cf501a575ac5',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	roleId: MisskeyIdSchema,
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	limit: z.number().int().min(1).max(100).default(10),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
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
		super(meta, paramDef, async (ps, me) => {
			const role = await this.rolesRepository.findOneBy({
				id: ps.roleId,
				isPublic: true,
				isExplorable: true,
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

			return await Promise.all(
				assigns.map(async (assign) => ({
					id: assign.id,
					user: await this.userEntityService.pack(assign.user!, me, {
						detail: true,
					}),
				})),
			) satisfies z.infer<typeof res>;
		});
	}
}
