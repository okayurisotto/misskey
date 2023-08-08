import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RoleService } from '@/core/RoleService.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.unknown();
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly roleService: RoleService,
		private readonly roleEntityService: RoleEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const [user, profile] = await Promise.all([
				this.prismaService.client.user.findUnique({
					where: { id: ps.userId },
				}),
				this.prismaService.client.user_profile.findUnique({
					where: { userId: ps.userId },
				}),
			]);

			if (user == null || profile == null) {
				throw new Error('user not found');
			}

			const isModerator = await this.roleService.isModerator(user);
			const isSilenced = !(await this.roleService.getUserPolicies(user.id))
				.canPublicNote;

			const me_ = await this.prismaService.client.user.findUniqueOrThrow({
				where: { id: me.id },
			});
			if (
				!(await this.roleService.isAdministrator(me_)) &&
				(await this.roleService.isAdministrator(user))
			) {
				throw new Error('cannot show info of admin');
			}

			const signins = await this.prismaService.client.signin.findMany({
				where: { userId: user.id },
			});

			const roleAssigns = await this.roleService.getUserAssigns(user.id);
			const roles = await this.roleService.getUserRoles(user.id);

			return {
				email: profile.email,
				emailVerified: profile.emailVerified,
				autoAcceptFollowed: profile.autoAcceptFollowed,
				noCrawle: profile.noCrawle,
				preventAiLearning: profile.preventAiLearning,
				alwaysMarkNsfw: profile.alwaysMarkNsfw,
				autoSensitive: profile.autoSensitive,
				carefulBot: profile.carefulBot,
				injectFeaturedNote: profile.injectFeaturedNote,
				receiveAnnouncementEmail: profile.receiveAnnouncementEmail,
				mutedWords: profile.mutedWords,
				mutedInstances: profile.mutedInstances,
				mutingNotificationTypes: profile.mutingNotificationTypes,
				isModerator: isModerator,
				isSilenced: isSilenced,
				isSuspended: user.isSuspended,
				lastActiveDate: user.lastActiveDate,
				moderationNote: profile.moderationNote,
				signins,
				policies: await this.roleService.getUserPolicies(user.id),
				roles: await Promise.all(
					roles.map((role) => this.roleEntityService.pack(role, me)),
				),
				roleAssigns: roleAssigns.map((a) => ({
					createdAt: a.createdAt.toISOString(),
					expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
					roleId: a.roleId,
				})),
			} satisfies z.infer<typeof res>;
		});
	}
}
