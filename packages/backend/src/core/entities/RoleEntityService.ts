import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { User } from '@/models/entities/User.js';
import type { Role } from '@/models/entities/Role.js';
import { bindThis } from '@/decorators.js';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleSchema } from '@/models/zod/RoleSchema.js';
import { RoleCondForumaValueSchema } from '@/models/zod/RoleCondFormula.js';
import { RolePoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';
import type { role } from '@prisma/client';

@Injectable()
export class RoleEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	@bindThis
	public async pack(
		src: Role['id'] | role,
		me?: { id: User['id'] } | null | undefined,
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

		const policies = RolePoliciesSchema.parse(role.policies);
		for (const [k, v] of Object.entries(DEFAULT_POLICIES)) {
			if (policies[k] == null)
				policies[k] = {
					useDefault: true,
					priority: 0,
					value: v,
				};
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
			condFormula: RoleCondForumaValueSchema.parse(role.condFormula),
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
