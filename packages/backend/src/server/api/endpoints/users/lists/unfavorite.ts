import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchList_______, notFavorited__ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ApiError } from '@/server/api/error.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	requireCredential: true,
	errors: {noSuchList:noSuchList_______,notFavorited:notFavorited__},
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
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const userListExist =
				(await this.prismaService.client.user_list.count({
					where: {
						id: ps.listId,
						isPublic: true,
					},
					take: 1,
				})) > 0;

			if (!userListExist) {
				throw new ApiError(meta.errors.noSuchList);
			}

			const exist =
				await this.prismaService.client.user_list_favorite.findUnique({
					where: {
						userId_userListId: {
							userListId: ps.listId,
							userId: me.id,
						},
					},
				});

			if (exist === null) {
				throw new ApiError(meta.errors.notFavorited);
			}

			await this.prismaService.client.user_list_favorite.delete({
				where: { id: exist.id },
			});
		});
	}
}
