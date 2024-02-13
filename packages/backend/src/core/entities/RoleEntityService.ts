import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { fromEntries, toEntries } from 'omick';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleSchema } from '@/models/zod/RoleSchema.js';
import { RoleCondFormulaValueSchema } from '@/models/zod/RoleCondFormulaSchema.js';
import { RolePoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';
import type { Role } from '@prisma/client';

@Injectable()
export class RoleEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * `role`をpackする。
	 *
	 * @param src
	 * @returns
	 */
	public async pack(
		src: Role['id'] | Role,
	): Promise<z.infer<typeof RoleSchema>> {
		const role =
			typeof src === 'object'
				? src
				: await this.prismaService.client.role.findUniqueOrThrow({
						where: { id: src },
				  });

		const assignedCount = await this.prismaService.client.roleAssignment.count(
			{
				where: {
					roleId: role.id,
					OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
				},
			},
		);

		const policies = {
			...fromEntries(
				toEntries(DEFAULT_POLICIES).map(([k, v]) => {
					switch (k) {
						case 'gtlAvailable':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'ltlAvailable':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'canPublicNote':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'canInvite':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'inviteLimit':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'inviteLimitCycle':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'inviteExpirationTime':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'canManageCustomEmojis':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'canSearchNotes':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'canHideAds':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'driveCapacityMb':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'alwaysMarkNsfw':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'pinLimit':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'antennaLimit':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'wordMuteLimit':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'webhookLimit':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'clipLimit':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'noteEachClipsLimit':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'userListLimit':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'userEachUserListsLimit':
							return [k, { useDefault: true, priority: 0, value: v }];
						case 'rateLimitFactor':
							return [k, { useDefault: true, priority: 0, value: v }];
						default:
							return k satisfies never;
					}
				}),
			),
			...RolePoliciesSchema.parse(role.policies),
		};

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
