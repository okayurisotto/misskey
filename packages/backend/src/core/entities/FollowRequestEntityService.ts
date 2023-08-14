import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { follow_request, user } from '@prisma/client';

@Injectable()
export class FollowRequestEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {
	}

	@bindThis
	public async pack(
		src: follow_request['id'] | follow_request,
		me?: { id: user['id'] } | null | undefined,
	) {
		const request = typeof src === 'object'
			? src
			: await this.prismaService.client.follow_request.findUniqueOrThrow({ where: { id: src } });

		return {
			id: request.id,
			follower: await this.userEntityService.pack(request.followerId, me),
			followee: await this.userEntityService.pack(request.followeeId, me),
		};
	}
}
