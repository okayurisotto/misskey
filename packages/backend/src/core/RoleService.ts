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
import type { Role, RoleAssignment, user } from '@prisma/client';

export type RolePolicies = Required<z.infer<typeof UserPoliciesSchema>>;

export const DEFAULT_POLICIES = {
	alwaysMarkNsfw: false,
	antennaLimit: 5,
	canHideAds: false,
	canInvite: false,
	canManageCustomEmojis: false,
	canPublicNote: true,
	canSearchNotes: false,
	clipLimit: 10,
	driveCapacityMb: 100,
	gtlAvailable: true,
	inviteExpirationTime: 0,
	inviteLimit: 0,
	inviteLimitCycle: 60 * 24 * 7,
	ltlAvailable: true,
	noteEachClipsLimit: 200,
	pinLimit: 5,
	rateLimitFactor: 1,
	userEachUserListsLimit: 50,
	userListLimit: 10,
	webhookLimit: 3,
	wordMuteLimit: 200,
} as const satisfies RolePolicies;

@Injectable()
export class RoleService {
	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
		private readonly redisClient: RedisService,
		private readonly roleConditionEvalService: RoleConditionEvalService,
	) {}

	public async getUserAssigns(userId: user['id']): Promise<RoleAssignment[]> {
		return await this.prismaService.client.roleAssignment.findMany({
			where: {
				userId,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
		});
	}

	public async getUserRoles(userId: user['id']): Promise<Role[]> {
		const roles = await this.prismaService.client.role.findMany({
			where: {
				OR: [
					{ target: 'conditional' },
					{
						assignments: {
							some: {
								userId,
								OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
							},
						},
					},
				],
			},
		});

		const conditionalRoles = roles.filter((r) => r.target === 'conditional');
		const assignedRoles = roles.filter((r) => r.target === 'manual');

		if (conditionalRoles.length === 0) {
			return assignedRoles;
		} else {
			const user = await this.prismaService.client.user.findUniqueOrThrow({
				where: { id: userId },
			});
			const matchedCondRoles = conditionalRoles.filter((role) => {
				const formula = RoleCondFormulaValueSchema.parse(role.condFormula);
				return this.roleConditionEvalService.eval(user, formula);
			});
			return [...assignedRoles, ...matchedCondRoles];
		}
	}

	public async getUserPolicies(
		userId: user['id'] | null,
	): Promise<RolePolicies> {
		const meta = await this.metaService.fetch();
		const basePolicies = {
			...DEFAULT_POLICIES,
			...UserPoliciesSchema.parse(meta.policies),
		};

		if (userId === null) return basePolicies;

		const roles = await this.getUserRoles(userId);

		const calc = <T extends keyof RolePolicies>(
			name: T,
			aggregate: (values: RolePolicies[T][]) => RolePolicies[T],
		): RolePolicies[T] => {
			if (roles.length === 0) return basePolicies[name];

			const policies = roles.map((role) => {
				const policies = RolePoliciesSchema.parse(role.policies);
				const policy = policies[name];
				if (policy !== undefined) return policy;
				return { priority: 0, useDefault: true } as const;
			});

			/** `Map<Priority, Policy[]>` */
			const policiesMap = policies.reduce((acc, cur) => {
				const prevValue = acc.get(cur.priority);
				if (prevValue === undefined) {
					acc.set(cur.priority, [cur]);
				} else {
					acc.set(cur.priority, [...prevValue, cur]);
				}
				return acc;
			}, new Map<number, typeof policies>());

			const [[, highPriorityPolicies]] = [...policiesMap].sort(
				([a], [b]) => b - a,
			);

			const values = highPriorityPolicies.map((policy) => {
				if (policy.useDefault) {
					return basePolicies[name];
				} else {
					return policy.value as RolePolicies[T]; // TODO
				}
			});

			return aggregate(values);
		};

		const some = (vs: boolean[]): boolean => vs.some((v) => v);
		const max = (vs: number[]): number => Math.max(...vs);

		return {
			alwaysMarkNsfw: calc('alwaysMarkNsfw', some),
			antennaLimit: calc('antennaLimit', max),
			canHideAds: calc('canHideAds', some),
			canInvite: calc('canInvite', some),
			canManageCustomEmojis: calc('canManageCustomEmojis', some),
			canPublicNote: calc('canPublicNote', some),
			canSearchNotes: calc('canSearchNotes', some),
			clipLimit: calc('clipLimit', max),
			driveCapacityMb: calc('driveCapacityMb', max),
			gtlAvailable: calc('gtlAvailable', some),
			inviteExpirationTime: calc('inviteExpirationTime', max),
			inviteLimit: calc('inviteLimit', max),
			inviteLimitCycle: calc('inviteLimitCycle', max),
			ltlAvailable: calc('ltlAvailable', some),
			noteEachClipsLimit: calc('noteEachClipsLimit', max),
			pinLimit: calc('pinLimit', max),
			rateLimitFactor: calc('rateLimitFactor', max),
			userEachUserListsLimit: calc('userEachUserListsLimit', max),
			userListLimit: calc('userListLimit', max),
			webhookLimit: calc('webhookLimit', max),
			wordMuteLimit: calc('wordMuteLimit', max),
		};
	}

	public async isModerator(
		user: { id: user['id']; isRoot: user['isRoot'] } | null,
	): Promise<boolean> {
		if (user === null) return false;
		if (user.isRoot) return true;
		const roles = await this.getUserRoles(user.id);
		return roles.some((role) => role.isModerator || role.isAdministrator);
	}

	public async isAdministrator(
		user: { id: user['id']; isRoot: user['isRoot'] } | null,
	): Promise<boolean> {
		if (user === null) return false;
		if (user.isRoot) return true;
		const roles = await this.getUserRoles(user.id);
		return roles.some((role) => role.isAdministrator);
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
