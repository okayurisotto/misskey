import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserPoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';
import type { Role, user } from '@prisma/client';

export type RolePolicies = Required<z.infer<typeof UserPoliciesSchema>>;

@Injectable()
export class RoleUtilService {
	public static AlreadyAssignedError = class extends Error {};
	public static NotAssignedError = class extends Error {};

	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async isExplorable(role: { id: Role['id'] } | null): Promise<boolean> {
		if (role == null) return false;
		const check = await this.prismaService.client.role.findUnique({
			where: { id: role.id },
		});
		if (check == null) return false;
		return check.isExplorable;
	}

	public async getModeratorIds(includeAdmins = true): Promise<user['id'][]> {
		const roles = await this.prismaService.client.role.findMany();
		const moderatorRoles = includeAdmins
			? roles.filter((r) => r.isModerator || r.isAdministrator)
			: roles.filter((r) => r.isModerator);
		const assigns =
			moderatorRoles.length > 0
				? await this.prismaService.client.roleAssignment.findMany({
						where: { roleId: { in: moderatorRoles.map((r) => r.id) } },
				  })
				: [];
		// TODO: isRootなアカウントも含める
		return assigns.map((a) => a.userId);
	}

	public async getModerators(includeAdmins = true): Promise<user[]> {
		const ids = await this.getModeratorIds(includeAdmins);
		const users =
			ids.length > 0
				? await this.prismaService.client.user.findMany({
						where: { id: { in: ids } },
				  })
				: [];
		return users;
	}

	public async getAdministratorIds(): Promise<user['id'][]> {
		const roles = await this.prismaService.client.role.findMany();
		const administratorRoles = roles.filter((r) => r.isAdministrator);
		const assigns =
			administratorRoles.length > 0
				? await this.prismaService.client.roleAssignment.findMany({
						where: { roleId: { in: administratorRoles.map((r) => r.id) } },
				  })
				: [];
		// TODO: isRootなアカウントも含める
		return assigns.map((a) => a.userId);
	}

	public async getAdministrators(): Promise<user[]> {
		const ids = await this.getAdministratorIds();
		const users =
			ids.length > 0
				? await this.prismaService.client.user.findMany({
						where: { id: { in: ids } },
				  })
				: [];
		return users;
	}

	public async assign(
		userId: string,
		roleId: string,
		expiresAt: Date | null = null,
	): Promise<void> {
		const now = new Date();

		const existing = await this.prismaService.client.roleAssignment.findUnique(
			{
				where: {
					userId_roleId: {
						roleId: roleId,
						userId: userId,
					},
				},
			},
		);

		if (existing) {
			if (existing.expiresAt && existing.expiresAt.getTime() < now.getTime()) {
				await this.prismaService.client.roleAssignment.delete({
					where: {
						userId_roleId: {
							roleId: roleId,
							userId: userId,
						},
					},
				});
			} else {
				throw new RoleUtilService.AlreadyAssignedError();
			}
		}

		const created = await this.prismaService.client.roleAssignment.create({
			data: {
				id: this.idService.genId(),
				createdAt: now,
				expiresAt: expiresAt,
				roleId: roleId,
				userId: userId,
			},
		});

		this.prismaService.client.role.update({
			where: { id: roleId },
			data: { lastUsedAt: new Date() },
		});
	}

	public async unassign(userId: string, roleId: Role['id']): Promise<void> {
		const now = new Date();

		const existing = await this.prismaService.client.roleAssignment.findUnique(
			{ where: { userId_roleId: { roleId, userId } } },
		);
		if (existing == null) {
			throw new RoleUtilService.NotAssignedError();
		} else if (
			existing.expiresAt &&
			existing.expiresAt.getTime() < now.getTime()
		) {
			await this.prismaService.client.roleAssignment.delete({
				where: {
					userId_roleId: {
						roleId: roleId,
						userId: userId,
					},
				},
			});
			throw new RoleUtilService.NotAssignedError();
		}

		await this.prismaService.client.roleAssignment.delete({
			where: { id: existing.id },
		});

		this.prismaService.client.role.update({
			where: { id: roleId },
			data: { lastUsedAt: now },
		});
	}
}
