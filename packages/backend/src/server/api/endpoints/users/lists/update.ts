import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { noSuchList________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { ApiError } from '../../../error.js';

const res = UserListSchema;
export const meta = {
	tags: ['lists'],
	requireCredential: true,
	kind: 'write:account',
	description: 'Update the properties of a list.',
	res,
	errors: { noSuchList: noSuchList________ },
} as const;

export const paramDef = z.object({
	listId: MisskeyIdSchema,
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
		private readonly userListEntityService: UserListEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const updated = await this.prismaService.client.user_list.update({
					where: { id: ps.listId, userId: me.id },
					data: {
						name: ps.name,
						isPublic: ps.isPublic,
					},
					include: { user_list_joining: true },
				});

				return this.userListEntityService.pack(ps.listId, {
					user_list: new EntityMap('id', [updated]),
					user_list_joining: new EntityMap('id', updated.user_list_joining),
				}) satisfies z.infer<typeof res>;
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2025') {
						throw new ApiError(meta.errors.noSuchList);
					}
				}

				throw e;
			}
		});
	}
}
