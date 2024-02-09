import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import type { UserListSchema } from '@/models/zod/UserListSchema.js';
import { EntityMap } from '@/misc/EntityMap.js';
import type { z } from 'zod';
import type { user_list, user_list_joining } from '@prisma/client';

@Injectable()
export class UserListEntityService {
	public pack(
		id: string,
		data: {
			user_list: EntityMap<'id', user_list>;
			user_list_joining: EntityMap<'id', user_list_joining>;
		},
	): z.infer<typeof UserListSchema> {
		const userList = data.user_list.get(id);

		const userIds = [...data.user_list_joining.values()]
			.filter(({ userListId }) => userListId === id)
			.map(({ userId }) => userId);

		return {
			...pick(userList, ['id', 'name', 'isPublic']),
			createdAt: userList.createdAt.toISOString(),
			userIds: userIds,
		};
	}
}
