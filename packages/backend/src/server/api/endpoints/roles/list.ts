import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RolesRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';

const res = z.unknown();
export const meta = {
	tags: ['role'],
	requireCredential: true,
	res,
} as const;

export const paramDef = z.object({});

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

		private roleEntityService: RoleEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const roles = await this.rolesRepository.findBy({
				isPublic: true,
				isExplorable: true,
			});
			return (await Promise.all(
				roles.map((role) => this.roleEntityService.pack(role, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
