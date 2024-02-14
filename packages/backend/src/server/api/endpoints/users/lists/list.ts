import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	noSuchUser_____________________,
	remoteUser,
	invalidParam,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { ApiError } from '@/server/api/error.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';

const res = z.array(UserListSchema);
export const meta = {
	tags: ['lists', 'account'],
	requireCredential: false,
	kind: 'read:account',
	description: 'Show all lists that the authenticated user has created.',
	res,
	errors: {
		noSuchUser: noSuchUser_____________________,
		remoteUser: remoteUser,
		invalidParam: invalidParam,
	},
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userListEntityService: UserListEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.userId !== undefined) {
				const user = await this.prismaService.client.user.findUnique({
					where: { id: ps.userId },
				});
				if (user === null) throw new ApiError(meta.errors.noSuchUser);
				if (user.host !== null) throw new ApiError(meta.errors.remoteUser);
			} else if (me === null) {
				throw new ApiError(meta.errors.invalidParam);
			}

			const userLists = await this.prismaService.client.user_list.findMany({
				where:
					ps.userId === undefined && me !== null
						? { userId: me.id }
						: { userId: ps.userId, isPublic: true },
				include: { user_list_joining: true },
			});

			const data = {
				user_list: new EntityMap('id', userLists),
				user_list_joining: new EntityMap(
					'id',
					userLists.flatMap(({ user_list_joining }) => user_list_joining),
				),
			};

			return await Promise.all(
				userLists.map((userList) =>
					this.userListEntityService.pack(userList.id, data),
				),
			);
		});
	}
}
