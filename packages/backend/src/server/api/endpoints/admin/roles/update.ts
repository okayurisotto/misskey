import { z } from 'zod';
import { Injectable } from '@nestjs/common';
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
			id: 'cd23ef55-09ad-428a-ac61-95a45e124b32',
		},
	},
} as const;

export const paramDef = z.object({
	roleId: MisskeyIdSchema,
	name: z.string(),
	description: z.string(),
	color: z.string().nullable(),
	iconUrl: z.string().nullable(),
	target: z.enum(['manual', 'conditional']),
	condFormula: z.unknown(),
	isPublic: z.boolean(),
	isModerator: z.boolean(),
	isAdministrator: z.boolean(),
	isExplorable: z.boolean().optional(),
	asBadge: z.boolean(),
	canEditMembersByModerator: z.boolean(),
	displayOrder: z.number(),
	policies: z.unknown(),
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
			const roleExist =
				(await this.prismaService.client.role.count({
					where: { id: ps.roleId },
					take: 1,
				})) > 0;
			if (!roleExist) {
				throw new ApiError(meta.errors.noSuchRole);
			}

			const date = new Date();
			await this.prismaService.client.role.update({
				where: { id: ps.roleId },
				data: {
					updatedAt: date,
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
			const updated = await this.prismaService.client.role.findUniqueOrThrow({
				where: { id: ps.roleId },
			});
			this.globalEventService.publishInternalEvent('roleUpdated', updated);
		});
	}
}
