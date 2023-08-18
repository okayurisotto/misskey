import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma, type role } from '@prisma/client';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApiError } from '@/server/api/error.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

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
	roleId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			let role: role;

			try {
				role = await this.prismaService.client.role.delete({
					where: { id: ps.roleId },
				});
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2025') {
						throw new ApiError(meta.errors.noSuchRole);
					}
				}

				throw e;
			}

			this.globalEventService.publishInternalEvent('roleDeleted', role);
		});
	}
}
