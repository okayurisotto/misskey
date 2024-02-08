import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { UserEntityPackLiteService } from './UserEntityPackLiteService.js';
import type { FollowRequest, user } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class FollowRequestEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	/**
	 * `follow_request`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	public async pack(
		src: FollowRequest['id'] | FollowRequest,
		me?: { id: user['id'] } | null | undefined,
	): Promise<{
		id: string;
		follower: z.infer<typeof UserLiteSchema>;
		followee: z.infer<typeof UserLiteSchema>;
	}> {
		const request =
			await this.prismaService.client.followRequest.findUniqueOrThrow({
				where: { id: typeof src === 'string' ? src : src.id },
				include: { followee: true, follower: true },
			});

		return {
			id: request.id,
			follower: await this.userEntityPackLiteService.packLite(request.follower),
			followee: await this.userEntityPackLiteService.packLite(request.followee),
		};
	}
}
