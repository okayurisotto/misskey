import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

// const res = z.unknown();
export const meta = {
	tags: ['lists'],
	requireCredential: true,
	kind: 'write:account',
	description: 'Delete an existing list of users.',
	errors: {
		noSuchList: {
			message: 'No such list.',
			code: 'NO_SUCH_LIST',
			id: '78436795-db79-42f5-b1e2-55ea2cf19166',
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
			const userList = await this.prismaService.client.user_list.findUnique({
				where: {
					id: ps.listId,
					userId: me.id,
				},
			});

			if (userList == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			await this.prismaService.client.user_list.delete({
				where: { id: userList.id },
			});
		});
	}
}
