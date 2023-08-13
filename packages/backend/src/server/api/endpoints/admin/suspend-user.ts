import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { User } from '@/models/entities/User.js';
import type { RelationshipJobData } from '@/queue/types.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { UserSuspendService } from '@/core/UserSuspendService.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { QueueService } from '@/core/QueueService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({ userId: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly userSuspendService: UserSuspendService,
		private readonly roleService: RoleService,
		private readonly moderationLogService: ModerationLogService,
		private readonly queueService: QueueService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const user = await this.prismaService.client.user.findUnique({
				where: { id: ps.userId },
			});

			if (user == null) {
				throw new Error('user not found');
			}

			if (await this.roleService.isModerator(user)) {
				throw new Error('cannot suspend moderator account');
			}

			await this.prismaService.client.user.update({
				where: { id: user.id },
				data: { isSuspended: true },
			});

			await this.moderationLogService.insertModerationLog(me, 'suspend', {
				targetId: user.id,
			});

			await this.userSuspendService.doPostSuspend(user);
			await this.unFollowAll(user);
		});
	}

	@bindThis
	private async unFollowAll(follower: user): Promise<void> {
		const followings = await this.prismaService.client.following.findMany({
			where: { followerId: follower.id },
		});

		await this.queueService.createUnfollowJob(
			followings.map<RelationshipJobData>((following) => ({
				from: { id: following.followerId },
				to: { id: following.followeeId },
				silent: true,
			})),
		);
	}
}
