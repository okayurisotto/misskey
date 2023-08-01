import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RolesRepository } from '@/models/index.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireAdmin: true,
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: 'de0d6ecd-8e0a-4253-88ff-74bc89ae3d45',
		},
	},
} as const;

export const paramDef = z.object({
	roleId: misskeyIdPattern,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.rolesRepository)
		private rolesRepository: RolesRepository,

		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps) => {
			const role = await this.rolesRepository.findOneBy({ id: ps.roleId });
			if (role == null) {
				throw new ApiError(meta.errors.noSuchRole);
			}
			await this.rolesRepository.delete({
				id: ps.roleId,
			});
			this.globalEventService.publishInternalEvent('roleDeleted', role);
		});
	}
}
