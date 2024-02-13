import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchRole________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { ApiError } from '../../error.js';

const res = z.array(
	z.object({
		id: MisskeyIdSchema,
		user: UserDetailedSchema,
	}),
);
export const meta = {
	tags: ['role', 'users'],
	requireCredential: false,
	errors: { noSuchRole: noSuchRole________ },
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
				where: {
					id: ps.roleId,
					isPublic: true,
					isExplorable: true,
				},
			});

			if (role == null) {
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
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
				include: { user: true },
			});

			return await Promise.all(
				assigns.map(async (assign) => ({
					id: assign.id,
					user: await this.userEntityService.packDetailed(assign.user, me),
				})),
			);
		});
	}
}
