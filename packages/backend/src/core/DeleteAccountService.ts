import { Injectable } from '@nestjs/common';
import { QueueService } from '@/core/QueueService.js';
import { UserSuspendService } from '@/core/UserSuspendService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { User } from '@prisma/client';

@Injectable()
export class DeleteAccountService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userSuspendService: UserSuspendService,
	) {}

	public async deleteAccount(user: Pick<User, 'id' | 'host'>): Promise<void> {
		const isRoot = await this.prismaService.client.user
			.count({
				where: { id: user.id, isRoot: true },
				take: 1,
			})
			.then((count) => count !== 0);
		if (isRoot) throw new Error('cannot delete a root account');

		// 物理削除する前にDelete activityを送信する
		await this.userSuspendService.doPostSuspend(user).catch(() => {});

		await this.queueService.createDeleteAccountJob(user, { soft: false });

		await this.prismaService.client.user.update({
			where: { id: user.id },
			data: { isDeleted: true },
		});
	}
}
