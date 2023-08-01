import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { UserListsRepository, UsersRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { ApiError } from '@/server/api/error.js';
import { DI } from '@/di-symbols.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(UserListSchema);
export const meta = {
	tags: ['lists', 'account'],
	requireCredential: false,
	kind: 'read:account',
	description: 'Show all lists that the authenticated user has created.',
	res,
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'a8af4a82-0980-4cc4-a6af-8b0ffd54465e',
		},
		remoteUser: {
			message: "Not allowed to load the remote user's list",
			code: 'REMOTE_USER_NOT_ALLOWED',
			id: '53858f1b-3315-4a01-81b7-db9b48d4b79a',
		},
		invalidParam: {
			message: 'Invalid param.',
			code: 'INVALID_PARAM',
			id: 'ab36de0e-29e9-48cb-9732-d82f1281620d',
		},
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
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		private userListEntityService: UserListEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (typeof ps.userId !== 'undefined') {
				const user = await this.usersRepository.findOneBy({ id: ps.userId });
				if (user === null) throw new ApiError(meta.errors.noSuchUser);
				if (user.host !== null) throw new ApiError(meta.errors.remoteUser);
			} else if (me === null) {
				throw new ApiError(meta.errors.invalidParam);
			}

			const userLists = await this.userListsRepository.findBy(
				typeof ps.userId === 'undefined' && me !== null
					? { userId: me.id }
					: { userId: ps.userId, isPublic: true },
			);

			return (await Promise.all(
				userLists.map((x) => this.userListEntityService.pack(x)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
