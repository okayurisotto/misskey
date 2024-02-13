import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	noSuchCode,
	cantDelete,
	accessDenied_________,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RoleService } from '@/core/RoleService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['meta'],
	requireCredential: true,
	requireRolePolicy: 'canInvite',
	errors: {
		noSuchCode: noSuchCode,
		cantDelete: cantDelete,
		accessDenied: accessDenied_________,
	},
} as const;

export const paramDef = z.object({
	inviteId: MisskeyIdSchema,
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
			const ticket =
				await this.prismaService.client.inviteCode.findUnique({
					where: { id: ps.inviteId },
				});
			const isModerator = await this.roleService.isModerator(me);

			if (ticket == null) {
				throw new ApiError(meta.errors.noSuchCode);
			}

			if (ticket.createdById !== me.id && !isModerator) {
				throw new ApiError(meta.errors.accessDenied);
			}

			if (ticket.usedAt && !isModerator) {
				throw new ApiError(meta.errors.cantDelete);
			}

			await this.prismaService.client.inviteCode.delete({
				where: { id: ticket.id },
			});
		});
	}
}
