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
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: '6503c040-6af4-4ed9-bf07-f2dd16678eab',
		},
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '558ea170-f653-4700-94d0-5a818371d0df',
		},
		accessDenied: {
			message: 'Only administrators can edit members of the role.',
			code: 'ACCESS_DENIED',
			id: '25b5bc31-dc79-4ebd-9bd2-c84978fd052c',
		},
	},
} as const;

export const paramDef = z.object({
	roleId: MisskeyIdSchema,
	userId: MisskeyIdSchema,
	expiresAt: z.number().int().nullable().optional(),
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
			if (role == null) {
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

			if (ps.expiresAt && ps.expiresAt <= Date.now()) {
				return;
			}

			await this.roleService.assign(
				ps.userId,
				ps.roleId,
				ps.expiresAt ? new Date(ps.expiresAt) : null,
			);
		});
	}
}
