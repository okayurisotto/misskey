import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type {
	UsersRepository,
	SigninsRepository,
	UserProfilesRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.unknown();
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	userId: misskeyIdPattern,
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.signinsRepository)
		private signinsRepository: SigninsRepository,

		private roleService: RoleService,
		private roleEntityService: RoleEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const [user, profile] = await Promise.all([
				this.usersRepository.findOneBy({ id: ps.userId }),
				this.userProfilesRepository.findOneBy({ userId: ps.userId }),
			]);

			if (user == null || profile == null) {
				throw new Error('user not found');
			}

			const isModerator = await this.roleService.isModerator(user);
			const isSilenced = !(await this.roleService.getUserPolicies(user.id))
				.canPublicNote;

			const _me = await this.usersRepository.findOneByOrFail({ id: me.id });
			if (
				!(await this.roleService.isAdministrator(_me)) &&
				(await this.roleService.isAdministrator(user))
			) {
				throw new Error('cannot show info of admin');
			}

			const signins = await this.signinsRepository.findBy({ userId: user.id });

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
				moderationNote: profile.moderationNote ?? '',
				signins,
				policies: await this.roleService.getUserPolicies(user.id),
				roles: await this.roleEntityService.packMany(roles, me),
				roleAssigns: roleAssigns.map((a) => ({
					createdAt: a.createdAt.toISOString(),
					expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
					roleId: a.roleId,
				})),
			} satisfies z.infer<typeof res>;
		});
	}
}
