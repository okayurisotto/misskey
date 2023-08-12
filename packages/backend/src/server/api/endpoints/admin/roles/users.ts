import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { ApiError } from '../../../error.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';

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
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: '224eff5e-2488-4b18-b3e7-f50d94421648',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	roleId: MisskeyIdSchema,
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	limit: z.number().int().min(1).max(100).default(10),
});

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

			const assigns = await this.prismaService.client.role_assignment.findMany({
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

			return (await Promise.all(
				assigns.map(async (assign) => ({
					id: assign.id,
					createdAt: assign.createdAt,
					user: await this.userEntityService.pack(assign.user, me, {
						detail: true,
					}),
					expiresAt: assign.expiresAt,
				})),
			)) satisfies z.infer<typeof res>;
		});
	}
}
