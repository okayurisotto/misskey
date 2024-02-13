import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	tooManyUserLists,
	noSuchList_,
	tooManyUsers,
} from '@/server/api/errors.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { ApiError } from '@/server/api/error.js';
import { RoleService } from '@/core/RoleService.js';
import { UserListService } from '@/core/UserListService.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { unique } from '@/misc/prelude/array.js';

const res = UserListSchema;
export const meta = {
	requireCredential: true,
	prohibitMoved: true,
	res,
	errors: {
		tooManyUserLists: tooManyUserLists,
		noSuchList: noSuchList_,
		tooManyUsers: tooManyUsers,
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
		private readonly userListService: UserListService,
		private readonly userListEntityService: UserListEntityService,
		private readonly idService: IdService,
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const baseUserList = await this.prismaService.client.user_list.findUnique(
				{
					where: { id: ps.listId, isPublic: true },
					include: {
						user_list_joining: {
							where: {
								user: {
									blockings_blocker: {
										none: { blockeeId: me.id },
									},
								},
							},
							include: { user: true },
						},
					},
				},
			);

			if (baseUserList === null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			const { currentCount, policies } = await awaitAll({
				currentCount: () =>
					this.prismaService.client.user_list.count({
						where: { userId: me.id },
					}),
				policies: () => this.roleService.getUserPolicies(me.id),
			});

			if (currentCount > policies.userListLimit) {
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

			const users = unique(
				baseUserList.user_list_joining.map((joining) => joining.user),
			);

			if (users.length > policies.userEachUserListsLimit) {
				throw new UserListService.TooManyUsersError();
			}

			for (const user of users) {
				try {
					await this.userListService.push(user, userList, me);
				} catch (err) {
					// TODO: あとで消す
					// すでにチェックしているのでここでは起きないはず
					if (err instanceof UserListService.TooManyUsersError) {
						throw new ApiError(meta.errors.tooManyUsers);
					}

					throw err;
				}
			}

			const result = await this.prismaService.client.user_list.findUnique({
				where: { id: userList.id },
				include: { user_list_joining: true },
			});

			if (result === null) {
				throw new Error();
			}

			return this.userListEntityService.pack(result.id, {
				user_list: new EntityMap('id', [result]),
				user_list_joining: new EntityMap('id', result.user_list_joining),
			});
		});
	}
}
