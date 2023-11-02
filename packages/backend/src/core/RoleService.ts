import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { z } from 'zod';
import { MemoryKVCache, MemorySingleCache } from '@/misc/cache.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { MetaService } from '@/core/MetaService.js';
import { CacheService } from '@/core/CacheService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { StreamMessages } from '@/server/api/stream/types.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleCondFormulaValueSchema } from '@/models/zod/RoleCondFormulaSchema.js';
import { RolePoliciesSchema, UserPoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { role, role_assignment, user } from '@prisma/client';

export type RolePolicies = Required<z.infer<typeof UserPoliciesSchema>>;

export const DEFAULT_POLICIES = {
	gtlAvailable: true,
	ltlAvailable: true,
	canPublicNote: true,
	canInvite: false,
	inviteLimit: 0,
	inviteLimitCycle: 60 * 24 * 7,
	inviteExpirationTime: 0,
	canManageCustomEmojis: false,
	canSearchNotes: false,
	canHideAds: false,
	driveCapacityMb: 100,
	alwaysMarkNsfw: false,
	pinLimit: 5,
	antennaLimit: 5,
	wordMuteLimit: 200,
	webhookLimit: 3,
	clipLimit: 10,
	noteEachClipsLimit: 200,
	userListLimit: 10,
	userEachUserListsLimit: 50,
	rateLimitFactor: 1,
} as const satisfies RolePolicies;

@Injectable()
export class RoleService implements OnApplicationShutdown {
	private rolesCache: MemorySingleCache<role[]>;
	private roleAssignmentByUserIdCache: MemoryKVCache<role_assignment[]>;

	public static AlreadyAssignedError = class extends Error {};
	public static NotAssignedError = class extends Error {};

	constructor(
		@Inject(DI.redis)
		private readonly redisClient: Redis.Redis,

		@Inject(DI.redisForSub)
		private readonly redisForSub: Redis.Redis,

		private readonly metaService: MetaService,
		private readonly cacheService: CacheService,
		private readonly userEntityService: UserEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		//this.onMessage = this.onMessage.bind(this);

		this.rolesCache = new MemorySingleCache<role[]>(1000 * 60 * 60 * 1);
		this.roleAssignmentByUserIdCache = new MemoryKVCache<role_assignment[]>(1000 * 60 * 60 * 1);

		this.redisForSub.on('message', this.onMessage);
	}

	@bindThis
	private async onMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } = obj.message as StreamMessages['internal']['payload'];
			switch (type) {
				case 'roleCreated': {
					const cached = this.rolesCache.get();
					if (cached) {
						cached.push({
							...body,
							createdAt: new Date(body.createdAt),
							updatedAt: new Date(body.updatedAt),
							lastUsedAt: new Date(body.lastUsedAt),
						});
					}
					break;
				}
				case 'roleUpdated': {
					const cached = this.rolesCache.get();
					if (cached) {
						const i = cached.findIndex(x => x.id === body.id);
						if (i > -1) {
							cached[i] = {
								...body,
								createdAt: new Date(body.createdAt),
								updatedAt: new Date(body.updatedAt),
								lastUsedAt: new Date(body.lastUsedAt),
							};
						}
					}
					break;
				}
				case 'roleDeleted': {
					const cached = this.rolesCache.get();
					if (cached) {
						this.rolesCache.set(cached.filter(x => x.id !== body.id));
					}
					break;
				}
				case 'userRoleAssigned': {
					const cached = this.roleAssignmentByUserIdCache.get(body.userId);
					if (cached) {
						cached.push({
							...body,
							createdAt: new Date(body.createdAt),
							expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
						});
					}
					break;
				}
				case 'userRoleUnassigned': {
					const cached = this.roleAssignmentByUserIdCache.get(body.userId);
					if (cached) {
						this.roleAssignmentByUserIdCache.set(body.userId, cached.filter(x => x.id !== body.id));
					}
					break;
				}
				default:
					break;
			}
		}
	}

	@bindThis
	private evalCond(user: user, value: z.infer<typeof RoleCondFormulaValueSchema>): boolean {
		try {
			switch (value.type) {
				case 'and': {
					return value.values.every(v => this.evalCond(user, v));
				}
				case 'or': {
					return value.values.some(v => this.evalCond(user, v));
				}
				case 'not': {
					return !this.evalCond(user, value.value);
				}
				case 'isLocal': {
					return this.userEntityService.isLocalUser(user);
				}
				case 'isRemote': {
					return this.userEntityService.isRemoteUser(user);
				}
				case 'createdLessThan': {
					return user.createdAt.getTime() > (Date.now() - (value.sec * 1000));
				}
				case 'createdMoreThan': {
					return user.createdAt.getTime() < (Date.now() - (value.sec * 1000));
				}
				case 'followersLessThanOrEq': {
					return user.followersCount <= value.value;
				}
				case 'followersMoreThanOrEq': {
					return user.followersCount >= value.value;
				}
				case 'followingLessThanOrEq': {
					return user.followingCount <= value.value;
				}
				case 'followingMoreThanOrEq': {
					return user.followingCount >= value.value;
				}
				case 'notesLessThanOrEq': {
					return user.notesCount <= value.value;
				}
				case 'notesMoreThanOrEq': {
					return user.notesCount >= value.value;
				}
				default:
					return false;
			}
		} catch (err) {
			// TODO: log error
			return false;
		}
	}

	@bindThis
	public async getUserAssigns(userId: user['id']): Promise<role_assignment[]> {
		const now = Date.now();
		let assigns = await this.roleAssignmentByUserIdCache.fetch(
			userId,
			() => this.prismaService.client.role_assignment.findMany({ where: { userId } }),
		);
		// 期限切れのロールを除外
		assigns = assigns.filter(a => a.expiresAt == null || (a.expiresAt.getTime() > now));
		return assigns;
	}

	@bindThis
	public async getUserRoles(userId: user['id']): Promise<role[]> {
		const roles = await this.rolesCache.fetch(() => this.prismaService.client.role.findMany());
		const assigns = await this.getUserAssigns(userId);
		const assignedRoles = roles.filter(r => assigns.map(x => x.roleId).includes(r.id));
		const user = roles.some(r => r.target === 'conditional') ? await this.cacheService.findUserById(userId) : null;
		const matchedCondRoles = roles.filter(r => r.target === 'conditional' && this.evalCond(user!, RoleCondFormulaValueSchema.parse(r.condFormula)));
		return [...assignedRoles, ...matchedCondRoles];
	}

	/**
	 * 指定ユーザーのバッジロール一覧取得
	 */
	@bindThis
	public async getUserBadgeRoles(userId: user['id']) {
		const now = Date.now();
		let assigns = await this.roleAssignmentByUserIdCache.fetch(
			userId,
			() => this.prismaService.client.role_assignment.findMany({ where: { userId } }),
		);
		// 期限切れのロールを除外
		assigns = assigns.filter(a => a.expiresAt == null || (a.expiresAt.getTime() > now));
		const assignedRoleIds = assigns.map(x => x.roleId);
		const roles = await this.rolesCache.fetch(() => this.prismaService.client.role.findMany());
		const assignedBadgeRoles = roles.filter(r => r.asBadge && assignedRoleIds.includes(r.id));
		const badgeCondRoles = roles.filter(r => r.asBadge && (r.target === 'conditional'));
		if (badgeCondRoles.length > 0) {
			const user = roles.some(r => r.target === 'conditional') ? await this.cacheService.findUserById(userId) : null;
			const matchedBadgeCondRoles = badgeCondRoles.filter(r => this.evalCond(user!, RoleCondFormulaValueSchema.parse(r.condFormula)));
			return [...assignedBadgeRoles, ...matchedBadgeCondRoles];
		} else {
			return assignedBadgeRoles;
		}
	}

	@bindThis
	public async getUserPolicies(userId: user['id'] | null): Promise<RolePolicies> {
		const meta = await this.metaService.fetch();
		const basePolicies = {
			...DEFAULT_POLICIES,
			...z.record(z.string(), z.any()).optional().parse(meta.policies),
		};

		if (userId == null) return basePolicies;

		const roles = await this.getUserRoles(userId);

		function calc<T extends keyof RolePolicies>(name: T, aggregate: (values: RolePolicies[T][]) => RolePolicies[T]) {
			if (roles.length === 0) return basePolicies[name];

			const policies = roles.map(role => RolePoliciesSchema.parse(role.policies)[name] ?? { priority: 0, useDefault: true });

			const p2 = policies.filter(policy => policy.priority === 2);
			if (p2.length > 0) return aggregate(p2.map(policy => policy.useDefault ? basePolicies[name] : policy.value));

			const p1 = policies.filter(policy => policy.priority === 1);
			if (p1.length > 0) return aggregate(p1.map(policy => policy.useDefault ? basePolicies[name] : policy.value));

			return aggregate(policies.map(policy => policy.useDefault ? basePolicies[name] : policy.value));
		}

		return {
			gtlAvailable: calc('gtlAvailable', vs => vs.some(v => v === true)),
			ltlAvailable: calc('ltlAvailable', vs => vs.some(v => v === true)),
			canPublicNote: calc('canPublicNote', vs => vs.some(v => v === true)),
			canInvite: calc('canInvite', vs => vs.some(v => v === true)),
			inviteLimit: calc('inviteLimit', vs => Math.max(...vs)),
			inviteLimitCycle: calc('inviteLimitCycle', vs => Math.max(...vs)),
			inviteExpirationTime: calc('inviteExpirationTime', vs => Math.max(...vs)),
			canManageCustomEmojis: calc('canManageCustomEmojis', vs => vs.some(v => v === true)),
			canSearchNotes: calc('canSearchNotes', vs => vs.some(v => v === true)),
			canHideAds: calc('canHideAds', vs => vs.some(v => v === true)),
			driveCapacityMb: calc('driveCapacityMb', vs => Math.max(...vs)),
			alwaysMarkNsfw: calc('alwaysMarkNsfw', vs => vs.some(v => v === true)),
			pinLimit: calc('pinLimit', vs => Math.max(...vs)),
			antennaLimit: calc('antennaLimit', vs => Math.max(...vs)),
			wordMuteLimit: calc('wordMuteLimit', vs => Math.max(...vs)),
			webhookLimit: calc('webhookLimit', vs => Math.max(...vs)),
			clipLimit: calc('clipLimit', vs => Math.max(...vs)),
			noteEachClipsLimit: calc('noteEachClipsLimit', vs => Math.max(...vs)),
			userListLimit: calc('userListLimit', vs => Math.max(...vs)),
			userEachUserListsLimit: calc('userEachUserListsLimit', vs => Math.max(...vs)),
			rateLimitFactor: calc('rateLimitFactor', vs => Math.max(...vs)),
		};
	}

	@bindThis
	public async isModerator(user: { id: user['id']; isRoot: user['isRoot'] } | null): Promise<boolean> {
		if (user == null) return false;
		return user.isRoot || (await this.getUserRoles(user.id)).some(r => r.isModerator || r.isAdministrator);
	}

	@bindThis
	public async isAdministrator(user: { id: user['id']; isRoot: user['isRoot'] } | null): Promise<boolean> {
		if (user == null) return false;
		return user.isRoot || (await this.getUserRoles(user.id)).some(r => r.isAdministrator);
	}

	@bindThis
	public async isExplorable(role: { id: role['id']} | null): Promise<boolean> {
		if (role == null) return false;
		const check = await this.prismaService.client.role.findUnique({ where: { id: role.id } });
		if (check == null) return false;
		return check.isExplorable;
	}

	@bindThis
	public async getModeratorIds(includeAdmins = true): Promise<user['id'][]> {
		const roles = await this.rolesCache.fetch(() => this.prismaService.client.role.findMany());
		const moderatorRoles = includeAdmins ? roles.filter(r => r.isModerator || r.isAdministrator) : roles.filter(r => r.isModerator);
		const assigns = moderatorRoles.length > 0
			? await this.prismaService.client.role_assignment.findMany({ where: { roleId: { in: moderatorRoles.map(r => r.id) } } })
			: [];
		// TODO: isRootなアカウントも含める
		return assigns.map(a => a.userId);
	}

	@bindThis
	public async getModerators(includeAdmins = true): Promise<user[]> {
		const ids = await this.getModeratorIds(includeAdmins);
		const users = ids.length > 0 ? await this.prismaService.client.user.findMany({
			where: { id: { in: ids } },
		}) : [];
		return users;
	}

	@bindThis
	public async getAdministratorIds(): Promise<user['id'][]> {
		const roles = await this.rolesCache.fetch(() => this.prismaService.client.role.findMany());
		const administratorRoles = roles.filter(r => r.isAdministrator);
		const assigns = administratorRoles.length > 0
			? await this.prismaService.client.role_assignment.findMany({ where: { roleId: { in: administratorRoles.map(r => r.id) } } })
			: [];
		// TODO: isRootなアカウントも含める
		return assigns.map(a => a.userId);
	}

	@bindThis
	public async getAdministrators(): Promise<user[]> {
		const ids = await this.getAdministratorIds();
		const users = ids.length > 0 ? await this.prismaService.client.user.findMany({
			where: { id: { in: ids } },
		}) : [];
		return users;
	}

	@bindThis
	public async assign(userId: user['id'], roleId: role['id'], expiresAt: Date | null = null): Promise<void> {
		const now = new Date();

		const existing = await this.prismaService.client.role_assignment.findUnique({
			where: {
				userId_roleId: {
					roleId: roleId,
					userId: userId,
				}
			}
		});

		if (existing) {
			if (existing.expiresAt && (existing.expiresAt.getTime() < now.getTime())) {
				await this.prismaService.client.role_assignment.delete({
					where: {
						userId_roleId: {
							roleId: roleId,
							userId: userId,
						},
					},
				});
			} else {
				throw new RoleService.AlreadyAssignedError();
			}
		}

		const created = await this.prismaService.client.role_assignment.create({
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

		this.globalEventService.publishInternalEvent('userRoleAssigned', created);
	}

	@bindThis
	public async unassign(userId: user['id'], roleId: role['id']): Promise<void> {
		const now = new Date();

		const existing = await this.prismaService.client.role_assignment.findUnique({ where: { userId_roleId: { roleId, userId } } });
		if (existing == null) {
			throw new RoleService.NotAssignedError();
		} else if (existing.expiresAt && (existing.expiresAt.getTime() < now.getTime())) {
			await this.prismaService.client.role_assignment.delete({
				where: {
					userId_roleId: {
						roleId: roleId,
						userId: userId,
					},
				},
			});
			throw new RoleService.NotAssignedError();
		}

		await this.prismaService.client.role_assignment.delete({ where: { id: existing.id } });

		this.prismaService.client.role.update({
			where: { id: roleId },
			data: { lastUsedAt: now },
		});

		this.globalEventService.publishInternalEvent('userRoleUnassigned', existing);
	}

	@bindThis
	public async addNoteToRoleTimeline(note: z.infer<typeof NoteSchema>): Promise<void> {
		const roles = await this.getUserRoles(note.userId);

		const redisPipeline = this.redisClient.pipeline();

		for (const role of roles) {
			redisPipeline.xadd(
				`roleTimeline:${role.id}`,
				'MAXLEN', '~', '1000',
				'*',
				'note', note.id);

			this.globalEventService.publishRoleTimelineStream(role.id, 'note', note);
		}

		redisPipeline.exec();
	}

	@bindThis
	public dispose(): void {
		this.redisForSub.off('message', this.onMessage);
		this.roleAssignmentByUserIdCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(): void {
		this.dispose();
	}
}
