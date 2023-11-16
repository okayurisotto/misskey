import { Injectable } from '@nestjs/common';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

@Injectable()
export class UserSuspendService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly queueService: QueueService,
		private readonly globalEventService: GlobalEventService,
		private readonly apRendererService: ApRendererService,
		private readonly prismaService: PrismaService,
	) {}

	public async doPostSuspend(user: { id: user['id']; host: user['host'] }): Promise<void> {
		this.globalEventService.publishInternalEvent('userChangeSuspendedState', { id: user.id, isSuspended: true });

		if (this.userEntityService.isLocalUser(user)) {
			// 知り得る全SharedInboxにDelete配信
			const content = this.apRendererService.addContext(this.apRendererService.renderDelete(this.userEntityService.genLocalUserUri(user.id), user));

			const queue: string[] = [];

			const followings = await this.prismaService.client.following.findMany({
				where: {
					OR: [
						{ followerSharedInbox: { not: null } },
						{ followeeSharedInbox: { not: null } },
					],
				},
			});

			const inboxes = followings.map(x => x.followerSharedInbox ?? x.followeeSharedInbox);

			for (const inbox of inboxes) {
				if (inbox != null && !queue.includes(inbox)) queue.push(inbox);
			}

			for (const inbox of queue) {
				this.queueService.deliver(user, content, inbox, true);
			}
		}
	}

	public async doPostUnsuspend(user: user): Promise<void> {
		this.globalEventService.publishInternalEvent('userChangeSuspendedState', { id: user.id, isSuspended: false });

		if (this.userEntityService.isLocalUser(user)) {
			// 知り得る全SharedInboxにUndo Delete配信
			const content = this.apRendererService.addContext(this.apRendererService.renderUndo(this.apRendererService.renderDelete(this.userEntityService.genLocalUserUri(user.id), user), user));

			const queue: string[] = [];

			const followings = await this.prismaService.client.following.findMany({
				where: {
					OR:[
						{ followerSharedInbox: { not: null } },
						{ followeeSharedInbox: { not: null } },
					]
				},
			});

			const inboxes = followings.map(x => x.followerSharedInbox ?? x.followeeSharedInbox);

			for (const inbox of inboxes) {
				if (inbox != null && !queue.includes(inbox)) queue.push(inbox);
			}

			for (const inbox of queue) {
				this.queueService.deliver(user, content, inbox, true);
			}
		}
	}
}
