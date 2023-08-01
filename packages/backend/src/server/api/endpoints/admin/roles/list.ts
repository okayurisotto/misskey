import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RolesRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { satisfies } from 'semver';

const res = z.unknown(); // TODO
export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireModerator: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.unknown();
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
			const roles = await this.rolesRepository.find({
				order: { lastUsedAt: 'DESC' },
			});
			return (await this.roleEntityService.packMany(
				roles,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
