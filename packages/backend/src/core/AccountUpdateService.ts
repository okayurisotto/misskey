import { Injectable } from '@nestjs/common';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { RelayService } from '@/core/RelayService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

@Injectable()
export class AccountUpdateService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly apRendererService: ApRendererService,
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly relayService: RelayService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async publishToFollowers(userId: user['id']): Promise<void> {
		const user = await this.prismaService.client.user.findUnique({
			where: { id: userId },
		});
		if (user === null) throw new Error('user not found');

		// フォロワーがリモートユーザー && 投稿者がローカルユーザー => Updateを配信
		if (this.userEntityService.isLocalUser(user)) {
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
