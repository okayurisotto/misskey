import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma, type Role } from '@prisma/client';
import { noSuchRole_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApiError } from '@/server/api/error.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireAdmin: true,
	errors: { noSuchRole: noSuchRole_ },
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
			let role: Role;

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
		});
	}
}
