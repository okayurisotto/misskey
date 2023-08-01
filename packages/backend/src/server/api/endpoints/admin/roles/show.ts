import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RolesRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.unknown();
export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: '07dc7d34-c0d8-49b7-96c6-db3ce64ee0b3',
		},
	},
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	roleId: misskeyIdPattern,
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

		private roleEntityService: RoleEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const role = await this.rolesRepository.findOneBy({ id: ps.roleId });
			if (role == null) {
				throw new ApiError(meta.errors.noSuchRole);
			}
			return (await this.roleEntityService.pack(role, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
