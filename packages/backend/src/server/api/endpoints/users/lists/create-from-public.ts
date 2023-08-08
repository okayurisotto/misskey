import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { ApiError } from '@/server/api/error.js';
import { RoleService } from '@/core/RoleService.js';
import { UserListService } from '@/core/UserListService.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = UserListSchema;
export const meta = {
	requireCredential: true,
	prohibitMoved: true,
	res,
	errors: {
		tooManyUserLists: {
			message: 'You cannot create user list any more.',
			code: 'TOO_MANY_USERLISTS',
			id: 'e9c105b2-c595-47de-97fb-7f7c2c33e92f',
		},
		noSuchList: {
			message: 'No such list.',
			code: 'NO_SUCH_LIST',
			id: '9292f798-6175-4f7d-93f4-b6742279667d',
		},
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '13c457db-a8cb-4d88-b70a-211ceeeabb5f',
		},
		alreadyAdded: {
			message: 'That user has already been added to that list.',
			code: 'ALREADY_ADDED',
			id: 'c3ad6fdb-692b-47ee-a455-7bd12c7af615',
		},
		youHaveBeenBlocked: {
			message:
				'You cannot push this user because you have been blocked by this user.',
			code: 'YOU_HAVE_BEEN_BLOCKED',
			id: 'a2497f2a-2389-439c-8626-5298540530f4',
		},
		tooManyUsers: {
			message: 'You can not push users any more.',
			code: 'TOO_MANY_USERS',
			id: '1845ea77-38d1-426e-8e4e-8b83b24f5bd7',
		},
	},
} as const;

export const paramDef = z.object({
	name: z.string().min(1).max(100),
	listId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private userListService: UserListService,
		private userListEntityService: UserListEntityService,
		private idService: IdService,
		private getterService: GetterService,
		private roleService: RoleService,
		private prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const listExist =
				(await this.prismaService.client.user_list.count({
					where: {
						id: ps.listId,
						isPublic: true,
					},
					take: 1,
				})) > 0;
			if (!listExist) throw new ApiError(meta.errors.noSuchList);

			const currentCount = await this.prismaService.client.user_list.count({
				where: { userId: me.id },
			});
			if (
				currentCount >
				(await this.roleService.getUserPolicies(me.id)).userListLimit
			) {
				throw new ApiError(meta.errors.tooManyUserLists);
			}

			const userList = await this.prismaService.client.user_list.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me.id,
					name: ps.name,
				},
			});

			const users = (
				await this.prismaService.client.user_list_joining.findMany({
					where: { userListId: ps.listId },
				})
			).map((x) => x.userId);

			for (const user of users) {
				const currentUser = await this.getterService
					.getUser(user)
					.catch((err) => {
						if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
							throw new ApiError(meta.errors.noSuchUser);
						}
						throw err;
					});

				if (currentUser.id !== me.id) {
					const blockExist =
						(await this.prismaService.client.blocking.count({
							where: {
								blockerId: currentUser.id,
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
							userId: currentUser.id,
						},
						take: 1,
					})) > 0;

				if (exist) {
					throw new ApiError(meta.errors.alreadyAdded);
				}

				try {
					await this.userListService.push(currentUser, userList, me);
				} catch (err) {
					if (err instanceof UserListService.TooManyUsersError) {
						throw new ApiError(meta.errors.tooManyUsers);
					}
					throw err;
				}
			}

			return (await this.userListEntityService.pack(
				userList,
			)) satisfies z.infer<typeof res>;
		});
	}
}
