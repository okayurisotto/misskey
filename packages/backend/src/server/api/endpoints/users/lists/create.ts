import { tooManyUserLists_ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { ApiError } from '@/server/api/error.js';
import { RoleService } from '@/core/RoleService.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = UserListSchema;
export const meta = {
	tags: ['lists'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	description: 'Create a new list of users.',
	res,
	errors: {tooManyUserLists:tooManyUserLists_},
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
		private readonly userListEntityService: UserListEntityService,
		private readonly idService: IdService,
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const currentCount = await this.prismaService.client.user_list.count({
				where: {
					userId: me.id,
				},
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

			return (await this.userListEntityService.pack(
				userList,
			)) satisfies z.infer<typeof res>;
		});
	}
}
