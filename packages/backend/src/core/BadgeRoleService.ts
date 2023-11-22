import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleCondFormulaValueSchema } from '@/models/zod/RoleCondFormulaSchema.js';
import { RoleConditionEvalService } from './RoleConditionEvalService.js';
import type { role, user } from '@prisma/client';

@Injectable()
export class BadgeRoleService {
	public static AlreadyAssignedError = class extends Error {};
	public static NotAssignedError = class extends Error {};

	constructor(
		private readonly prismaService: PrismaService,
		private readonly roleConditionEvalService: RoleConditionEvalService,
	) {}

	/** 指定ユーザーのバッジロール一覧取得 */
	public async getUserBadgeRoles(userId: user['id']): Promise<role[]> {
		const [user, badgeCondRoles] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: userId, host: null },
				include: {
					role_assignment: {
						where: {
							userId,
							OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
							role: { asBadge: true },
						},
						include: { role: true },
					},
				},
			}),
			this.prismaService.client.role.findMany({
				where: { target: 'conditional' },
			}),
		]);

		const assigns = user.role_assignment;
		const assignedBadgeRoles = assigns.map(({ role }) => role);
		const matchedBadgeCondRoles = badgeCondRoles.filter((role) => {
			return this.roleConditionEvalService.eval(
				user,
				RoleCondFormulaValueSchema.parse(role.condFormula),
			);
		});

		return [...assignedBadgeRoles, ...matchedBadgeCondRoles];
	}
}
