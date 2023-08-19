import { noSuchRole___, noSuchUser_, notAssigned, accessDenied_ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ApiError } from '@/server/api/error.js';
import { RoleService } from '@/core/RoleService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireModerator: true,
	errors: {noSuchRole:noSuchRole___,noSuchUser:noSuchUser_,notAssigned:notAssigned,accessDenied:accessDenied_},
} as const;

export const paramDef = z.object({
	roleId: MisskeyIdSchema,
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const role = await this.prismaService.client.role.findUnique({
				where: { id: ps.roleId },
			});
			if (role === null) {
				throw new ApiError(meta.errors.noSuchRole);
			}

			const iAmAdmin = await this.roleService.isAdministrator(me);

			if (!role.canEditMembersByModerator && !iAmAdmin) {
				throw new ApiError(meta.errors.accessDenied);
			}

			const user = await this.prismaService.client.user.findUnique({
				where: { id: ps.userId },
			});
			if (user === null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			await this.roleService.unassign(user.id, role.id);
		});
	}
}
