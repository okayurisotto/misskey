import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { UsersRepository, BlockingsRepository } from '@/models/index.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { ApiError } from '../../error.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

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
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	userId: misskeyIdPattern,
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.blockingsRepository)
		private blockingsRepository: BlockingsRepository,

		private userEntityService: UserEntityService,
		private getterService: GetterService,
		private userBlockingService: UserBlockingService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const blocker = await this.usersRepository.findOneByOrFail({ id: me.id });

			// Check if the blockee is yourself
			if (me.id === ps.userId) {
				throw new ApiError(meta.errors.blockeeIsYourself);
			}

			// Get blockee
			const blockee = await this.getterService
				.getUser(ps.userId)
				.catch((err) => {
					if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
						throw new ApiError(meta.errors.noSuchUser);
					}
					throw err;
				});

			// Check not blocking
			const exist = await this.blockingsRepository.exist({
				where: {
					blockerId: blocker.id,
					blockeeId: blockee.id,
				},
			});

			if (!exist) {
				throw new ApiError(meta.errors.notBlocking);
			}

			// Delete blocking
			await this.userBlockingService.unblock(blocker, blockee);

			return (await this.userEntityService.pack(blockee.id, blocker, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
