import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type {
	UserListsRepository,
	UserListFavoritesRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { DI } from '@/di-symbols.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { ApiError } from '../../../error.js';

const res = UserListSchema;
export const meta = {
	tags: ['lists', 'account'],
	requireCredential: false,
	kind: 'read:account',
	description: 'Show the properties of a list.',
	res,
	errors: {
		noSuchList: {
			message: 'No such list.',
			code: 'NO_SUCH_LIST',
			id: '7bc05c21-1d7a-41ae-88f1-66820f4dc686',
		},
	},
} as const;

export const paramDef = z.object({
	listId: MisskeyIdSchema,
	forPublic: z.boolean().default(false),
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

		@Inject(DI.userListFavoritesRepository)
		private userListFavoritesRepository: UserListFavoritesRepository,

		private userListEntityService: UserListEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const additionalProperties: Partial<{
				likedCount: number;
				isLiked: boolean;
			}> = {};
			// Fetch the list
			const userList = await this.userListsRepository.findOneBy(
				!ps.forPublic && me !== null
					? { id: ps.listId, userId: me.id }
					: { id: ps.listId, isPublic: true },
			);

			if (userList == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			if (ps.forPublic && userList.isPublic) {
				additionalProperties.likedCount =
					await this.userListFavoritesRepository.countBy({
						userListId: ps.listId,
					});
				if (me !== null) {
					additionalProperties.isLiked =
						await this.userListFavoritesRepository.exist({
							where: {
								userId: me.id,
								userListId: ps.listId,
							},
						});
				} else {
					additionalProperties.isLiked = false;
				}
			}
			return {
				...(await this.userListEntityService.pack(userList)),
				...additionalProperties,
			} satisfies z.infer<typeof res>;
		});
	}
}
