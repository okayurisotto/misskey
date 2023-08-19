import { noSuchList____, noSuchUser______________________ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['lists', 'users'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	description: 'Remove a user from a list.',
	errors: {noSuchList:noSuchList____,noSuchUser:noSuchUser______________________},
} as const;

export const paramDef = z.object({
	listId: MisskeyIdSchema,
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly getterService: GetterService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch the list
			const userList = await this.prismaService.client.user_list.findUnique({
				where: {
					id: ps.listId,
					userId: me.id,
				},
			});

			if (userList == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			// Fetch the user
			const user = await this.getterService.getUser(ps.userId).catch((err) => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
					throw new ApiError(meta.errors.noSuchUser);
				}
				throw err;
			});

			// Pull the user
			await this.prismaService.client.user_list_joining.delete({
				where: {
					userId_userListId: {
						userListId: userList.id,
						userId: user.id,
					},
				},
			});

			this.globalEventService.publishUserListStream(
				userList.id,
				'userRemoved',
				await this.userEntityService.packLite(user),
			);
		});
	}
}
