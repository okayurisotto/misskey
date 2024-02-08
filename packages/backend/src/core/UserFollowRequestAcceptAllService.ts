import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import { UserFollowRequestAcceptService } from './UserFollowRequestAcceptService.js';
import type { user } from '@prisma/client';

@Injectable()
export class UserFollowRequestAcceptAllService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userFollowRequestAcceptService: UserFollowRequestAcceptService,
	) {}

	public async acceptAll(user: {
		id: user['id'];
		host: user['host'];
		uri: user['host'];
		inbox: user['inbox'];
		sharedInbox: user['sharedInbox'];
	}): Promise<void> {
		const requests = await this.prismaService.client.followRequest.findMany({
			where: { followeeId: user.id },
		});

		for (const request of requests) {
			const follower = await this.prismaService.client.user.findUniqueOrThrow({
				where: { id: request.followerId },
			});
			await this.userFollowRequestAcceptService.accept(user, follower);
		}
	}
}
