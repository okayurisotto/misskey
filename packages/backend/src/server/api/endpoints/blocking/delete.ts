import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = UserDetailedNotMeSchema;
export const meta = {
	tags: ['account'],
	limit: {
		duration: ms('1hour'),
		max: 100,
	},
	requireCredential: true,
	kind: 'write:blocks',
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '8621d8bf-c358-4303-a066-5ea78610eb3f',
		},
		blockeeIsYourself: {
			message: 'Blockee is yourself.',
			code: 'BLOCKEE_IS_YOURSELF',
			id: '06f6fac6-524b-473c-a354-e97a40ae6eac',
		},
		notBlocking: {
			message: 'You are not blocking that user.',
			code: 'NOT_BLOCKING',
			id: '291b2efa-60c6-45c0-9f6a-045c8f9b02cd',
		},
	},
	res,
} as const;

export const paramDef = z.object({ userId: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly userBlockingService: UserBlockingService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const blocker = await this.prismaService.client.user.findUniqueOrThrow({
				where: { id: me.id },
			});

			// Check if the blockee is yourself
			if (me.id === ps.userId) {
				throw new ApiError(meta.errors.blockeeIsYourself);
			}

			// Get blockee
			const blockee = await this.prismaService.client.user.findUnique({
				where: { id: ps.userId },
			});
			if (blockee === null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			// Check not blocking
			const notExist =
				(await this.prismaService.client.blocking.findUnique({
					where: {
						blockerId_blockeeId: {
							blockerId: blocker.id,
							blockeeId: blockee.id,
						},
					},
				})) === null;

			if (notExist) {
				throw new ApiError(meta.errors.notBlocking);
			}

			// Delete blocking
			await this.userBlockingService.unblock(blocker, blockee);

			return await this.userEntityService.pack(blockee.id, blocker, {
				detail: true,
			});
		});
	}
}
