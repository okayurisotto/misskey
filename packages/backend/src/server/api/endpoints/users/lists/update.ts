import { noSuchList________ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { UserListSchema } from '@/models/zod/UserListSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = UserListSchema;
export const meta = {
	tags: ['lists'],
	requireCredential: true,
	kind: 'write:account',
	description: 'Update the properties of a list.',
	res,
	errors: {noSuchList:noSuchList________},
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
			const userList = await this.prismaService.client.user_list.findUnique({
				where: {
					id: ps.listId,
					userId: me.id,
				},
			});

			if (userList == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			await this.prismaService.client.user_list.update({
				where: { id: userList.id },
				data: {
					name: ps.name,
					isPublic: ps.isPublic,
				},
			});

			return (await this.userListEntityService.pack(
				userList.id,
			)) satisfies z.infer<typeof res>;
		});
	}
}
