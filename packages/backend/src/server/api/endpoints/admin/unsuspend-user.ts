import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { UsersRepository } from '@/models/index.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { UserSuspendService } from '@/core/UserSuspendService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
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
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private userSuspendService: UserSuspendService,
		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const user = await this.usersRepository.findOneBy({ id: ps.userId });

			if (user == null) {
				throw new Error('user not found');
			}

			await this.usersRepository.update(user.id, {
				isSuspended: false,
			});

			this.moderationLogService.insertModerationLog(me, 'unsuspend', {
				targetId: user.id,
			});

			this.userSuspendService.doPostUnsuspend(user);
		});
	}
}
