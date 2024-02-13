import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import { UserFollowRequestAcceptService } from './UserFollowRequestAcceptService.js';
import type { User } from '@prisma/client';

@Injectable()
export class UserFollowRequestAcceptAllService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userFollowRequestAcceptService: UserFollowRequestAcceptService,
	) {}

	public async acceptAll(user: {
		id: User['id'];
		host: User['host'];
		uri: User['host'];
		inbox: User['inbox'];
		sharedInbox: User['sharedInbox'];
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
