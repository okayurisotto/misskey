import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { UserListsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

// const res = z.unknown();
export const meta = {
	tags: ['lists'],
	requireCredential: true,
	kind: 'write:account',
	description: 'Delete an existing list of users.',
	errors: {
		noSuchList: {
			message: 'No such list.',
			code: 'NO_SUCH_LIST',
			id: '78436795-db79-42f5-b1e2-55ea2cf19166',
		},
	},
} as const;

const paramDef_ = z.object({
	listId: misskeyIdPattern,
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const userList = await this.userListsRepository.findOneBy({
				id: ps.listId,
				userId: me.id,
			});

			if (userList == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			await this.userListsRepository.delete(userList.id);
		});
	}
}
