import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { UserListSchema } from '@/models/zod/UserListSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { z } from 'zod';
import type { user_list } from '@prisma/client';

@Injectable()
export class UserListEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	@bindThis
	public async pack(
		src: user_list['id'] | user_list,
	): Promise<z.infer<typeof UserListSchema>> {
		const userList = typeof src === 'object'
			? src
			: await this.prismaService.client.user_list.findUniqueOrThrow({ where: { id: src } });

		const users = await this.prismaService.client.user_list_joining.findMany({
			where: { userListId: userList.id },
		});

		return {
			id: userList.id,
			createdAt: userList.createdAt.toISOString(),
			name: userList.name,
			userIds: users.map(x => x.userId),
			isPublic: userList.isPublic,
		};
	}
}
