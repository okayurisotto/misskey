import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.unknown();
export const meta = {
	tags: ['role', 'users'],
	requireCredential: false,
	res,
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: 'de5502bf-009a-4639-86c1-fec349e46dcb',
		},
	},
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
				where: {
					id: ps.roleId,
					isPublic: true,
				},
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
