import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchRole_____ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { ApiError } from '../../../error.js';

const res = z.array(
	z.object({
		id: MisskeyIdSchema,
		createdAt: z.unknown(),
		user: UserDetailedSchema,
		expiresAt: z.unknown(),
	}),
);
export const meta = {
	tags: ['admin', 'role', 'users'],
	requireCredential: false,
	requireAdmin: true,
	errors: { noSuchRole: noSuchRole_____ },
	res,
} as const;

export const paramDef = z
	.object({
		roleId: MisskeyIdSchema,
		limit: limit({ max: 100, default: 10 }),
	})
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const role = await this.prismaService.client.role.findUnique({
				where: { id: ps.roleId },
			});
			if (role === null) {
				throw new ApiError(meta.errors.noSuchRole);
			}

			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const assigns = await this.prismaService.client.roleAssignment.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ roleId: role.id },
						{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
					],
				},
				include: { user: true },
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				assigns.map(async (assign) => ({
					id: assign.id,
					createdAt: assign.createdAt,
					user: await this.userEntityService.packDetailed(assign.user, me),
					expiresAt: assign.expiresAt,
				})),
			);
		});
	}
}
