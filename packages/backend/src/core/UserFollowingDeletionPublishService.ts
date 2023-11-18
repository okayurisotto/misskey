import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { WebhookService } from '@/core/WebhookService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import type { z } from 'zod';

type Local =
	| LocalUser
	| {
			id: LocalUser['id'];
			host: LocalUser['host'];
			uri: LocalUser['uri'];
	  };
type Remote =
	| RemoteUser
	| {
			id: RemoteUser['id'];
			host: RemoteUser['host'];
			uri: RemoteUser['uri'];
			inbox: RemoteUser['inbox'];
	  };
type Both = Local | Remote;

@Injectable()
export class UserFollowingDeletionPublishService {
	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly queueService: QueueService,
		private readonly userEntityService: UserEntityService,
		private readonly webhookService: WebhookService,
	) {}

	/**
	 * Publish unfollow to local
	 */
	public async publish(followee: Both, follower: Local): Promise<void> {
		const packedFollowee = await this.userEntityService.packDetailed(
			followee.id,
			follower,
		);

		this.globalEventService.publishMainStream(
			follower.id,
			'unfollow',
			packedFollowee as z.infer<typeof UserDetailedNotMeSchema>,
		);

		const webhooks = (await this.webhookService.getActiveWebhooks()).filter(
			(x) => x.userId === follower.id && x.on.includes('unfollow'),
		);
		for (const webhook of webhooks) {
			this.queueService.webhookDeliver(webhook, 'unfollow', {
				user: packedFollowee,
			});
		}
	}
}
