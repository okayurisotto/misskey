import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { MetaService } from '@/core/MetaService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleCondFormulaValueSchema } from '@/models/zod/RoleCondFormulaSchema.js';
import {
	RolePoliciesSchema,
	UserPoliciesSchema,
} from '@/models/zod/RolePoliciesSchema.js';
import { RedisService } from '@/core/RedisService.js';
import { RoleConditionEvalService } from './RoleConditionEvalService.js';
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
export class RoleService {
	public static AlreadyAssignedError = class extends Error {};
	public static NotAssignedError = class extends Error {};

	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
		private readonly redisClient: RedisService,
		private readonly roleConditionEvalService: RoleConditionEvalService,
	) {}

	public async getUserAssigns(userId: user['id']): Promise<role_assignment[]> {
		return await this.prismaService.client.role_assignment.findMany({
			where: {
				userId,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
		});
	}

	public async getUserRoles(userId: user['id']): Promise<role[]> {
		const roles = await this.prismaService.client.role.findMany();
		const assigns = await this.getUserAssigns(userId);
		const assignedRoles = roles.filter((r) =>
			assigns.map((x) => x.roleId).includes(r.id),
		);
		const user = roles.some((r) => r.target === 'conditional')
			? await this.prismaService.client.user.findUnique({
					where: { id: userId },
			  })
			: null;
		const matchedCondRoles = roles.filter((r) => {
			return (
				r.target === 'conditional' &&
				this.roleConditionEvalService.eval(
					user!,
					RoleCondFormulaValueSchema.parse(r.condFormula),
				)
			);
		});
		return [...assignedRoles, ...matchedCondRoles];
	}

	public async getUserPolicies(
		userId: user['id'] | null,
	): Promise<RolePolicies> {
		const meta = await this.metaService.fetch();
		const basePolicies = {
			...DEFAULT_POLICIES,
			...z.record(z.string(), z.any()).optional().parse(meta.policies),
		};

		if (userId == null) return basePolicies;

		const roles = await this.getUserRoles(userId);

		function calc<T extends keyof RolePolicies>(
			name: T,
			aggregate: (values: RolePolicies[T][]) => RolePolicies[T],
		): RolePolicies[T] {
			if (roles.length === 0) return basePolicies[name];

			const policies = roles.map(
				(role) =>
					RolePoliciesSchema.parse(role.policies)[name] ?? {
						priority: 0,
						useDefault: true,
					},
			);

			const p2 = policies.filter((policy) => policy.priority === 2);
			if (p2.length > 0)
				return aggregate(
					p2.map((policy) =>
						policy.useDefault ? basePolicies[name] : policy.value,
					),
				);

			const p1 = policies.filter((policy) => policy.priority === 1);
			if (p1.length > 0)
				return aggregate(
					p1.map((policy) =>
						policy.useDefault ? basePolicies[name] : policy.value,
					),
				);

			return aggregate(
				policies.map((policy) =>
					policy.useDefault ? basePolicies[name] : policy.value,
				),
			);
		}

		return {
			gtlAvailable: calc('gtlAvailable', (vs) => vs.some((v) => v)),
			ltlAvailable: calc('ltlAvailable', (vs) => vs.some((v) => v)),
			canPublicNote: calc('canPublicNote', (vs) => vs.some((v) => v)),
			canInvite: calc('canInvite', (vs) => vs.some((v) => v)),
			inviteLimit: calc('inviteLimit', (vs) => Math.max(...vs)),
			inviteLimitCycle: calc('inviteLimitCycle', (vs) => Math.max(...vs)),
			inviteExpirationTime: calc('inviteExpirationTime', (vs) =>
				Math.max(...vs),
			),
			canManageCustomEmojis: calc('canManageCustomEmojis', (vs) =>
				vs.some((v) => v),
			),
			canSearchNotes: calc('canSearchNotes', (vs) => vs.some((v) => v)),
			canHideAds: calc('canHideAds', (vs) => vs.some((v) => v)),
			driveCapacityMb: calc('driveCapacityMb', (vs) => Math.max(...vs)),
			alwaysMarkNsfw: calc('alwaysMarkNsfw', (vs) => vs.some((v) => v)),
			pinLimit: calc('pinLimit', (vs) => Math.max(...vs)),
			antennaLimit: calc('antennaLimit', (vs) => Math.max(...vs)),
			wordMuteLimit: calc('wordMuteLimit', (vs) => Math.max(...vs)),
			webhookLimit: calc('webhookLimit', (vs) => Math.max(...vs)),
			clipLimit: calc('clipLimit', (vs) => Math.max(...vs)),
			noteEachClipsLimit: calc('noteEachClipsLimit', (vs) => Math.max(...vs)),
			userListLimit: calc('userListLimit', (vs) => Math.max(...vs)),
			userEachUserListsLimit: calc('userEachUserListsLimit', (vs) =>
				Math.max(...vs),
			),
			rateLimitFactor: calc('rateLimitFactor', (vs) => Math.max(...vs)),
		};
	}

	public async isModerator(
		user: { id: user['id']; isRoot: user['isRoot'] } | null,
	): Promise<boolean> {
		if (user == null) return false;
		return (
			user.isRoot ||
			(await this.getUserRoles(user.id)).some(
				(r) => r.isModerator || r.isAdministrator,
			)
		);
	}

	public async isAdministrator(
		user: { id: user['id']; isRoot: user['isRoot'] } | null,
	): Promise<boolean> {
		if (user == null) return false;
		return (
			user.isRoot ||
			(await this.getUserRoles(user.id)).some((r) => r.isAdministrator)
		);
	}

	public async addNoteToRoleTimeline(
		note: z.infer<typeof NoteSchema>,
	): Promise<void> {
		const roles = await this.getUserRoles(note.userId);

		const redisPipeline = this.redisClient.pipeline();

		for (const role of roles) {
			redisPipeline.xadd(
				`roleTimeline:${role.id}`,
				'MAXLEN',
				'~',
				'1000',
				'*',
				'note',
				note.id,
			);

			this.globalEventService.publishRoleTimelineStream(role.id, 'note', note);
		}

		redisPipeline.exec();
	}
}
