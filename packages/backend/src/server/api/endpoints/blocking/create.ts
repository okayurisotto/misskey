import { noSuchUser__, blockeeIsYourself, alreadyBlocking } from '@/server/api/errors.js';
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
		max: 20,
	},
	requireCredential: true,
	kind: 'write:blocks',
	errors: {noSuchUser:noSuchUser__,blockeeIsYourself:blockeeIsYourself,alreadyBlocking:alreadyBlocking},
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

			// 自分自身
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

			// Check if already blocking
			const exist =
				(await this.prismaService.client.blocking.findUnique({
					where: {
						blockerId_blockeeId: {
							blockerId: blocker.id,
							blockeeId: blockee.id,
						},
					},
				})) !== null;

			if (exist) {
				throw new ApiError(meta.errors.alreadyBlocking);
			}

			await this.userBlockingService.block(blocker, blockee);

			return await this.userEntityService.packDetailed(blockee.id, blocker);
		});
	}
}
