import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { UserFollowRequestDeleteService } from './UserFollowRequestDeleteService.js';
import { UserFollowingDeleteService } from './UserFollowingDeleteService.js';
import { UserFollowingDeletionPublishService } from './UserFollowingDeletionPublishService.js';

type Local = LocalUser | Pick<LocalUser, 'id' | 'host' | 'uri'>;
type Remote = RemoteUser | Pick<RemoteUser, 'id' | 'host' | 'uri' | 'inbox'>;

@Injectable()
export class UserFollowingRejectionRecieveService {
	constructor(
		private readonly userFollowingDeleteService: UserFollowingDeleteService,
		private readonly userFollowingDeletionPublishService: UserFollowingDeletionPublishService,
		private readonly userFollowRequestDeleteService: UserFollowRequestDeleteService,
	) {}

	public async receive(actor: Remote, follower: Local): Promise<void> {
		await this.userFollowRequestDeleteService.delete(actor, follower);
		await this.userFollowingDeleteService.delete(actor, follower);
		await this.userFollowingDeletionPublishService.publish(actor, follower);
	}
}
