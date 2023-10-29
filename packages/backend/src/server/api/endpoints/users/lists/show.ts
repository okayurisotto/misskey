import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchList______ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { ApiError } from '../../../error.js';

const res = UserListSchema;
export const meta = {
	tags: ['lists', 'account'],
	requireCredential: false,
	kind: 'read:account',
	description: 'Show the properties of a list.',
	res: res.extend({
		likedCount: z.number().int().nonnegative().optional(),
		isLiked: z.boolean().optional(),
	}),
	errors: { noSuchList: noSuchList______ },
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
					ps.forPublic || me === null
						? { id: ps.listId, isPublic: true }
						: { id: ps.listId, userId: me.id },
				include: { user_list_joining: true },
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
				...this.userListEntityService.pack(userList.id, {
					user_list: new EntityMap('id', [userList]),
					user_list_joining: new EntityMap('id', userList.user_list_joining),
				}),
				...additionalProperties,
			} satisfies z.infer<typeof res>;
		});
	}
}
