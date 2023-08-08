import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ApiError } from '@/server/api/error.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	requireCredential: true,
	errors: {
		noSuchList: {
			message: 'No such user list.',
			code: 'NO_SUCH_USER_LIST',
			id: 'baedb33e-76b8-4b0c-86a8-9375c0a7b94b',
		},
		notFavorited: {
			message: 'You have not favorited the list.',
			code: 'ALREADY_FAVORITED',
			id: '835c4b27-463d-4cfa-969b-a9058678d465',
		},
	},
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
