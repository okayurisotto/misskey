import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RoleService } from '@/core/RoleService.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.record(z.string(), z.unknown());
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
			const user = await this.prismaService.client.user.findUnique({
				where: { id: ps.userId },
				include: { userProfile: true, signins: true },
			});

			if (user === null) {
				throw new Error('Unable to locate the requested user.');
			}

			if (user.userProfile === null) {
				throw new Error('Unable to locate the requested user_profile.');
			}

			const [me_, userIsAdmin] = await Promise.all([
				this.prismaService.client.user.findUniqueOrThrow({
					where: { id: me.id },
				}),
				this.roleService.isAdministrator(user),
			]);

			const iAmNotAdmin = !(await this.roleService.isAdministrator(me_));

			if (iAmNotAdmin && userIsAdmin) {
				throw new Error('You are not authorized to access this information.');
			}

			const [roleAssigns, roles, isModerator, policies] = await Promise.all([
				this.roleService.getUserAssigns(user.id),
				this.roleService.getUserRoles(user.id),
				this.roleService.isModerator(user),
				this.roleService.getUserPolicies(user.id),
			]);

			const packedRoles = await Promise.all(
				roles.map((role) => this.roleEntityService.pack(role)),
			);

			const packedRoleAssigns = roleAssigns.map((a) => ({
				createdAt: a.createdAt.toISOString(),
				expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
				roleId: a.roleId,
			}));
			const isSilenced = !policies.canPublicNote;

			return {
				...pick(user.userProfile, [
					'email',
					'emailVerified',
					'autoAcceptFollowed',
					'noCrawle',
					'preventAiLearning',
					'alwaysMarkNsfw',
					'autoSensitive',
					'carefulBot',
					'injectFeaturedNote',
					'receiveAnnouncementEmail',
					'mutedWords',
					'mutedInstances',
					'mutingNotificationTypes',
					'moderationNote',
				]),

				...pick(user, ['isSuspended', 'lastActiveDate']),

				isModerator,
				isSilenced,
				policies,

				signins: user.signins,
				roles: packedRoles,
				roleAssigns: packedRoleAssigns,
			};
		});
	}
}
