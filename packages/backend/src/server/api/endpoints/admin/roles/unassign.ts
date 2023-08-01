import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RolesRepository, UsersRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { RoleService } from '@/core/RoleService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: '6e519036-a70d-4c76-b679-bc8fb18194e2',
		},
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '2b730f78-1179-461b-88ad-d24c9af1a5ce',
		},
		notAssigned: {
			message: 'Not assigned.',
			code: 'NOT_ASSIGNED',
			id: 'b9060ac7-5c94-4da4-9f55-2047c953df44',
		},
		accessDenied: {
			message: 'Only administrators can edit members of the role.',
			code: 'ACCESS_DENIED',
			id: '24636eee-e8c1-493e-94b2-e16ad401e262',
		},
	},
} as const;

const paramDef_ = z.object({
	roleId: misskeyIdPattern,
	userId: misskeyIdPattern,
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.rolesRepository)
		private rolesRepository: RolesRepository,

		private roleService: RoleService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const role = await this.rolesRepository.findOneBy({ id: ps.roleId });
			if (role == null) {
				throw new ApiError(meta.errors.noSuchRole);
			}

			if (
				!role.canEditMembersByModerator &&
				!(await this.roleService.isAdministrator(me))
			) {
				throw new ApiError(meta.errors.accessDenied);
			}

			const user = await this.usersRepository.findOneBy({ id: ps.userId });
			if (user == null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			await this.roleService.unassign(user.id, role.id);
		});
	}
}
