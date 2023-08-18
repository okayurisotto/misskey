import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueueService } from '@/core/QueueService.js';
import { UserSuspendService } from '@/core/UserSuspendService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
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
		private readonly userEntityService: UserEntityService,
		private readonly queueService: QueueService,
		private readonly userSuspendService: UserSuspendService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const user = await this.prismaService.client.user.findUnique({
				where: { id: ps.userId },
			});

			if (user == null) {
				throw new Error('user not found');
			}

			if (user.isRoot) {
				throw new Error('cannot delete a root account');
			}

			if (this.userEntityService.isLocalUser(user)) {
				// 物理削除する前にDelete activityを送信する
				// TODO: `Promise.all`しても問題ないか確認する
				await this.userSuspendService.doPostSuspend(user);
				await this.queueService.createDeleteAccountJob(user, { soft: false });
			} else {
				// リモートユーザーの削除は、完全にDBから物理削除してしまうと再度連合してきてアカウントが復活する可能性があるため、soft指定する
				await this.queueService.createDeleteAccountJob(user, { soft: true });
			}

			await this.prismaService.client.user.update({
				where: { id: user.id },
				data: { isDeleted: true },
			});
		});
	}
}
