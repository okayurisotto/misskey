import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { bindThis } from '@/decorators.js';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleSchema } from '@/models/zod/RoleSchema.js';
import { RoleCondFormulaValueSchema } from '@/models/zod/RoleCondFormulaSchema.js';
import { RolePoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';
import type { role, user } from '@prisma/client';

@Injectable()
export class RoleEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	@bindThis
	public async pack(
		src: role['id'] | role,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof RoleSchema>> {
		const role =
			typeof src === 'object'
				? src
				: await this.prismaService.client.role.findUniqueOrThrow({ where: { id: src } });

		const assignedCount = await this.prismaService.client.role_assignment.count({
			where: {
				roleId: role.id,
				OR: [
					{ expiresAt: null },
					{ expiresAt: { gt: new Date() } }
				],
			},
		});

		let policies = RolePoliciesSchema.parse(role.policies);
		for (const [k, v] of Object.entries(DEFAULT_POLICIES)) {
			if (!(k in policies)) {
				policies = {
					...policies,
					[k]: {
						useDefault: true,
						priority: 0,
						value: v,
					},
				}
			}
		}

		return {
			id: role.id,
			createdAt: role.createdAt.toISOString(),
			updatedAt: role.updatedAt.toISOString(),
			name: role.name,
			description: role.description,
			color: role.color,
			iconUrl: role.iconUrl,
			target: role.target,
			condFormula: RoleCondFormulaValueSchema.parse(role.condFormula),
			isPublic: role.isPublic,
			isAdministrator: role.isAdministrator,
			isModerator: role.isModerator,
			isExplorable: role.isExplorable,
			asBadge: role.asBadge,
			canEditMembersByModerator: role.canEditMembersByModerator,
			displayOrder: role.displayOrder,
			policies: policies,
			usersCount: assignedCount,
		};
	}
}
