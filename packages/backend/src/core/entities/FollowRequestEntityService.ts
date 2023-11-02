import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type { follow_request, user } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class FollowRequestEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	/**
	 * `follow_request`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	@bindThis
	public async pack(
		src: follow_request['id'] | follow_request,
		me?: { id: user['id'] } | null | undefined,
	): Promise<{ id: string; follower: z.infer<typeof UserLiteSchema>; followee: z.infer<typeof UserLiteSchema> }> {
		const request = await this.prismaService.client.follow_request.findUniqueOrThrow({
			where: { id: typeof src === 'string' ? src : src.id },
			include: { user_follow_request_followeeIdTouser: true, user_follow_request_followerIdTouser: true },
		});

		return {
			id: request.id,
			follower: await this.userEntityService.packLite(request.user_follow_request_followerIdTouser),
			followee: await this.userEntityService.packLite(request.user_follow_request_followeeIdTouser),
		};
	}
}
