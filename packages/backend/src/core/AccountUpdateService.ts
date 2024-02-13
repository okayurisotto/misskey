import { Injectable } from '@nestjs/common';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { RelayService } from '@/core/RelayService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { User } from '@prisma/client';

@Injectable()
export class AccountUpdateService {
	constructor(
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly apRendererService: ApRendererService,
		private readonly prismaService: PrismaService,
		private readonly relayService: RelayService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async publishToFollowers(userId: User['id']): Promise<void> {
		const user = await this.prismaService.client.user.findUnique({
			where: { id: userId },
		});
		if (user === null) throw new Error('user not found');

		// フォロワーがリモートユーザー && 投稿者がローカルユーザー => Updateを配信
		if (this.userEntityUtilService.isLocalUser(user)) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderUpdate(
					await this.apRendererService.renderPerson(user),
					user,
				),
			);

			await Promise.all([
				this.apDeliverManagerService.deliverToFollowers(user, content),
				this.relayService.deliverToRelays(user, content),
			]);
		}
	}
}
