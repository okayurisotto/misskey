import { noSuchList_____, noSuchUser_______________________, alreadyAdded_, youHaveBeenBlocked____, tooManyUsers_ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserListService } from '@/core/UserListService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['lists', 'users'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	description: 'Add a user to an existing list.',
	limit: {
		duration: ms('1hour'),
		max: 30,
	},
	errors: {noSuchList:noSuchList_____,noSuchUser:noSuchUser_______________________,alreadyAdded:alreadyAdded_,youHaveBeenBlocked:youHaveBeenBlocked____,tooManyUsers:tooManyUsers_},
} as const;

export const paramDef = z.object({
	listId: MisskeyIdSchema,
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly getterService: GetterService,
		private readonly userListService: UserListService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch the list
			const userList = await this.prismaService.client.user_list.findUnique({
				where: {
					id: ps.listId,
					userId: me.id,
				},
			});

			if (userList == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			// Fetch the user
			const user = await this.getterService.getUser(ps.userId).catch((err) => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
					throw new ApiError(meta.errors.noSuchUser);
				}
				throw err;
			});

			// Check blocking
			if (user.id !== me.id) {
				const blockExist =
					(await this.prismaService.client.blocking.count({
						where: {
							blockerId: user.id,
							blockeeId: me.id,
						},
						take: 1,
					})) > 0;
				if (blockExist) {
					throw new ApiError(meta.errors.youHaveBeenBlocked);
				}
			}

			const exist =
				(await this.prismaService.client.user_list_joining.count({
					where: {
						userListId: userList.id,
						userId: user.id,
					},
					take: 1,
				})) > 1;

			if (exist) {
				throw new ApiError(meta.errors.alreadyAdded);
			}

			try {
				await this.userListService.push(user, userList, me);
			} catch (err) {
				if (err instanceof UserListService.TooManyUsersError) {
					throw new ApiError(meta.errors.tooManyUsers);
				}

				throw err;
			}
		});
	}
}
