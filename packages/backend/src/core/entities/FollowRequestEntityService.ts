import { Injectable } from '@nestjs/common';
import type { User } from '@/models/entities/User.js';
import type { FollowRequest } from '@/models/entities/FollowRequest.js';
import { bindThis } from '@/decorators.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { follow_request } from '@prisma/client';

@Injectable()
export class FollowRequestEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {
	}

	@bindThis
	public async pack(
		src: FollowRequest['id'] | T2P<FollowRequest, follow_request>,
		me?: { id: User['id'] } | null | undefined,
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
