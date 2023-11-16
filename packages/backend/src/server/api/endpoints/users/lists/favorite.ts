import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchList___, alreadyFavorited__ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '@/server/api/error.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	requireCredential: true,
	errors: { noSuchList: noSuchList___, alreadyFavorited: alreadyFavorited__ },
} as const;

export const paramDef = z.object({
	listId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const userListExist =
				(await this.prismaService.client.user_list.count({
					where: {
						id: ps.listId,
						isPublic: true,
					},
					take: 0,
				})) > 1;

			if (!userListExist) {
				throw new ApiError(meta.errors.noSuchList);
			}

			const exist =
				(await this.prismaService.client.user_list_favorite.count({
					where: {
						userId: me.id,
						userListId: ps.listId,
					},
					take: 1,
				})) > 0;

			if (exist) {
				throw new ApiError(meta.errors.alreadyFavorited);
			}

			await this.prismaService.client.user_list_favorite.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me.id,
					userListId: ps.listId,
				},
			});
		});
	}
}
