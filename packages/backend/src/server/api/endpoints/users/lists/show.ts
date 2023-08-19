import { noSuchList______ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { ApiError } from '../../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = UserListSchema;
export const meta = {
	tags: ['lists', 'account'],
	requireCredential: false,
	kind: 'read:account',
	description: 'Show the properties of a list.',
	res,
	errors: {noSuchList:noSuchList______},
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
		private readonly userListEntityService: UserListEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const additionalProperties: Partial<{
				likedCount: number;
				isLiked: boolean;
			}> = {};
			// Fetch the list
			const userList = await this.prismaService.client.user_list.findUnique({
				where:
					!ps.forPublic && me !== null
						? { id: ps.listId, userId: me.id }
						: { id: ps.listId, isPublic: true },
			});

			if (userList == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			if (ps.forPublic && userList.isPublic) {
				additionalProperties.likedCount =
					await this.prismaService.client.user_list_favorite.count({
						where: {
							userListId: ps.listId,
						},
					});
				if (me !== null) {
					additionalProperties.isLiked =
						(await this.prismaService.client.user_list_favorite.count({
							where: {
								userId: me.id,
								userListId: ps.listId,
							},
							take: 1,
						})) > 0;
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
