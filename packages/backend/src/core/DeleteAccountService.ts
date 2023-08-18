import { Injectable } from '@nestjs/common';
import { QueueService } from '@/core/QueueService.js';
import { UserSuspendService } from '@/core/UserSuspendService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';

@Injectable()
export class DeleteAccountService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userSuspendService: UserSuspendService,
	) {}

	@bindThis
	public async deleteAccount(user: {
		id: string;
		host: string | null;
	}): Promise<void> {
		const user_ = await this.prismaService.client.user.findUniqueOrThrow({ where: { id: user.id } });
		if (user_.isRoot) throw new Error('cannot delete a root account');

		// 物理削除する前にDelete activityを送信する
		await this.userSuspendService.doPostSuspend(user).catch(() => {});

		this.queueService.createDeleteAccountJob(user, { soft: false });

		await this.prismaService.client.user.update({
			where: { id: user.id },
			data: { isDeleted: true },
		});
	}
}
