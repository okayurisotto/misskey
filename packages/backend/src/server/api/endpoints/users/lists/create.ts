import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { UserListsRepository } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import type { UserList } from '@/models/entities/UserList.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { RoleService } from '@/core/RoleService.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';

const res = UserListSchema;
export const meta = {
	tags: ['lists'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	description: 'Create a new list of users.',
	res,
	errors: {
		tooManyUserLists: {
			message: 'You cannot create user list any more.',
			code: 'TOO_MANY_USERLISTS',
			id: '0cf21a28-7715-4f39-a20d-777bfdb8d138',
		},
	},
} as const;

export const paramDef = z.object({
	name: z.string().min(1).max(100),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		private userListEntityService: UserListEntityService,
		private idService: IdService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const currentCount = await this.userListsRepository.countBy({
				userId: me.id,
			});
			if (
				currentCount >
				(await this.roleService.getUserPolicies(me.id)).userListLimit
			) {
				throw new ApiError(meta.errors.tooManyUserLists);
			}

			const userList = await this.userListsRepository
				.insert({
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me.id,
					name: ps.name,
				} as UserList)
				.then((x) =>
					this.userListsRepository.findOneByOrFail(x.identifiers[0]),
				);

			return (await this.userListEntityService.pack(
				userList,
			)) satisfies z.infer<typeof res>;
		});
	}
}
