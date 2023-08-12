import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdService } from '@/core/IdService.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.record(z.string(), z.unknown());
export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireAdmin: true,
	res,
} as const;

export const paramDef = z.object({
	name: z.string(),
	description: z.string(),
	color: z.string().nullable(),
	iconUrl: z.string().nullable(),
	target: z.enum(['manual', 'conditional']),
	condFormula: z.unknown(),
	isPublic: z.boolean(),
	isModerator: z.boolean(),
	isAdministrator: z.boolean(),
	isExplorable: z.boolean().default(false),
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
	typeof res
> {
	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly roleEntityService: RoleEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const date = new Date();
			const created = await this.prismaService.client.role.create({
				data: {
					id: this.idService.genId(),
					createdAt: date,
					updatedAt: date,
					lastUsedAt: date,
					name: ps.name,
					description: ps.description,
					color: ps.color,
					iconUrl: ps.iconUrl,
					target: ps.target,
					condFormula: ps.condFormula,
					isPublic: ps.isPublic,
					isAdministrator: ps.isAdministrator,
					isModerator: ps.isModerator,
					isExplorable: ps.isExplorable,
					asBadge: ps.asBadge,
					canEditMembersByModerator: ps.canEditMembersByModerator,
					displayOrder: ps.displayOrder,
					policies: ps.policies,
				},
			});

			this.globalEventService.publishInternalEvent('roleCreated', created);

			return (await this.roleEntityService.pack(created, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
