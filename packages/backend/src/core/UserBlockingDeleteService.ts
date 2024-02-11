import { Injectable } from '@nestjs/common';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import Logger from '@/misc/logger.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { user } from '@prisma/client';

@Injectable()
export class UserBlockingDeleteService {
	private readonly logger = new Logger('user-block');

	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async delete(blocker: user, blockee: user): Promise<void> {
		const blocking_ = await this.prismaService.client.blocking.findUnique({
			where: {
				blockerId_blockeeId: {
					blockerId: blocker.id,
					blockeeId: blockee.id,
				},
			},
		});

		if (blocking_ == null) {
			this.logger.warn(
				'ブロック解除がリクエストされましたがブロックしていませんでした',
			);
			return;
		}

		// Since we already have the blocker and blockee, we do not need to fetch
		// them in the query above and can just manually insert them here.
		const blocking = {
			...blocking_,
			blocker,
			blockee,
		};

		await this.prismaService.client.blocking.delete({
			where: { id: blocking.id },
		});

		// deliver if remote bloking
		if (
			this.userEntityUtilService.isLocalUser(blocker) &&
			this.userEntityUtilService.isRemoteUser(blockee)
		) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderUndo(
					this.apRendererService.renderBlock(blocking),
					blocker,
				),
			);
			this.queueService.deliver(blocker, content, blockee.inbox, false);
		}
	}
}
