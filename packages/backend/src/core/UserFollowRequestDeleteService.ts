import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { PrismaService } from '@/core/PrismaService.js';

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
export class UserFollowRequestDeleteService {
	constructor(private readonly prismaService: PrismaService) {}

	public async delete(followee: Both, follower: Both): Promise<void> {
		const request = await this.prismaService.client.followRequest.findUnique({
			where: {
				followerId_followeeId: {
					followeeId: followee.id,
					followerId: follower.id,
				},
			},
		});

		if (!request) return;

		await this.prismaService.client.followRequest.delete({
			where: { id: request.id },
		});
	}
}
