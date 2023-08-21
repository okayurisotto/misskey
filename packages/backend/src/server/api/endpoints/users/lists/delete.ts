import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchList__ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['lists'],
	requireCredential: true,
	kind: 'write:account',
	description: 'Delete an existing list of users.',
	errors: {noSuchList:noSuchList__},
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
