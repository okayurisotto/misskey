import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { noSuchRole____ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApiError } from '@/server/api/error.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleCondFormulaValueSchema } from '@/models/zod/RoleCondFormulaSchema.js';
import { RolePoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';

export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireAdmin: true,
	errors: { noSuchRole: noSuchRole____ },
} as const;

export const paramDef = z.object({
	roleId: MisskeyIdSchema,
	name: z.string(),
	description: z.string(),
	color: z.string().nullable(),
	iconUrl: z.string().nullable(),
	target: z.enum(['manual', 'conditional']),
	condFormula: RoleCondFormulaValueSchema,
	isPublic: z.boolean(),
	isModerator: z.boolean(),
	isAdministrator: z.boolean(),
	isExplorable: z.boolean().optional(),
	asBadge: z.boolean(),
	canEditMembersByModerator: z.boolean(),
	displayOrder: z.number(),
	policies: RolePoliciesSchema,
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
			let updated;
			try {
				updated = await this.prismaService.client.role.update({
					where: { id: ps.roleId },
					data: {
						updatedAt: new Date(),
						name: ps.name,
						description: ps.description,
						color: ps.color,
						iconUrl: ps.iconUrl,
						target: ps.target,
						condFormula: ps.condFormula,
						isPublic: ps.isPublic,
						isModerator: ps.isModerator,
						isAdministrator: ps.isAdministrator,
						isExplorable: ps.isExplorable,
						asBadge: ps.asBadge,
						canEditMembersByModerator: ps.canEditMembersByModerator,
						displayOrder: ps.displayOrder,
						policies: ps.policies,
					},
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
