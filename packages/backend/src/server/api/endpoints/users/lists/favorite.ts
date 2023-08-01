import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	UserListFavoritesRepository,
	UserListsRepository,
} from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '@/server/api/error.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

// const res = z.unknown();
export const meta = {
	requireCredential: true,
	errors: {
		noSuchList: {
			message: 'No such user list.',
			code: 'NO_SUCH_USER_LIST',
			id: '7dbaf3cf-7b42-4b8f-b431-b3919e580dbe',
		},
		alreadyFavorited: {
			message: 'The list has already been favorited.',
			code: 'ALREADY_FAVORITED',
			id: '6425bba0-985b-461e-af1b-518070e72081',
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

		@Inject(DI.userListFavoritesRepository)
		private userListFavoritesRepository: UserListFavoritesRepository,
		private idService: IdService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const userListExist = await this.userListsRepository.exist({
				where: {
					id: ps.listId,
					isPublic: true,
				},
			});

			if (!userListExist) {
				throw new ApiError(meta.errors.noSuchList);
			}

			const exist = await this.userListFavoritesRepository.exist({
				where: {
					userId: me.id,
					userListId: ps.listId,
				},
			});

			if (exist) {
				throw new ApiError(meta.errors.alreadyFavorited);
			}

			await this.userListFavoritesRepository.insert({
				id: this.idService.genId(),
				createdAt: new Date(),
				userId: me.id,
				userListId: ps.listId,
			});
		});
	}
}
