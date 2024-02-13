import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { UserSuspendService } from '@/core/UserSuspendService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

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
		private readonly moderationLogService: ModerationLogService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const [user] = await Promise.all([
				(async (): Promise<User> => {
					try {
						return await this.prismaService.client.user.update({
							where: { id: ps.userId },
							data: { isSuspended: false },
						});
					} catch (e) {
						if (e instanceof Prisma.PrismaClientKnownRequestError) {
							if (e.code === 'P2025') {
								throw new Error('Unable to locate the requested user.');
							}
						}

						throw e;
					}
				})(),
				this.moderationLogService.insertModerationLog(me, 'unsuspend', {
					targetId: ps.userId,
				}),
			]);

			await this.userSuspendService.doPostUnsuspend(user);
		});
	}
}
