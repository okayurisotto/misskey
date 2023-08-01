import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { RolesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.unknown();
export const meta = {
	tags: ['role', 'users'],
	requireCredential: false,
	res: generateSchema(res),
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: 'de5502bf-009a-4639-86c1-fec349e46dcb',
		},
	},
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
			const role = await this.rolesRepository.findOneBy({
				id: ps.roleId,
				isPublic: true,
			});

			if (role == null) {
				throw new ApiError(meta.errors.noSuchRole);
			}

			return await this.roleEntityService.pack(role, me) satisfies z.infer<typeof res>;
		});
	}
}
