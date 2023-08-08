import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ApiError } from '@/server/api/error.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

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
		super(meta, paramDef, async (ps, me) => {
			const role = await this.prismaService.client.role.findUnique({
				where: { id: ps.roleId },
			});
			if (role == null) {
				throw new ApiError(meta.errors.noSuchRole);
			}
			return (await this.roleEntityService.pack(role, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
