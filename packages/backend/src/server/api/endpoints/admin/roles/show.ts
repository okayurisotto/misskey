import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchRole__ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ApiError } from '@/server/api/error.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleSchema } from '@/models/zod/RoleSchema.js';

const res = RoleSchema;
export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireModerator: true,
	errors: { noSuchRole: noSuchRole__ },
	res,
} as const;

export const paramDef = z.object({
	roleId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly roleEntityService: RoleEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const role = await this.prismaService.client.role.findUnique({
				where: { id: ps.roleId },
			});

			if (role == null) {
				throw new ApiError(meta.errors.noSuchRole);
			}

			return await this.roleEntityService.pack(role);
		});
	}
}
