import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { UserListsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = UserListSchema;
export const meta = {
	tags: ['lists'],
	requireCredential: true,
	kind: 'write:account',
	description: 'Update the properties of a list.',
	res,
	errors: {
		noSuchList: {
			message: 'No such list.',
			code: 'NO_SUCH_LIST',
			id: '796666fe-3dff-4d39-becb-8a5932c1d5b7',
		},
	},
} as const;

export const paramDef = z.object({
	listId: misskeyIdPattern,
	name: z.string().min(1).max(100).optional(),
	isPublic: z.boolean().optional(),
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
	) {
		super(meta, paramDef, async (ps, me) => {
			const userList = await this.userListsRepository.findOneBy({
				id: ps.listId,
				userId: me.id,
			});

			if (userList == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			await this.userListsRepository.update(userList.id, {
				name: ps.name,
				isPublic: ps.isPublic,
			});

			return (await this.userListEntityService.pack(
				userList.id,
			)) satisfies z.infer<typeof res>;
		});
	}
}
