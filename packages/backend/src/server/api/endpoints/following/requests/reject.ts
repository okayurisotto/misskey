import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchUser_________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['following', 'account'],
	requireCredential: true,
	kind: 'write:following',
	errors: { noSuchUser: noSuchUser_________ },
} as const;

export const paramDef = z.object({
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
		private readonly getterService: GetterService,
		private readonly userFollowingService: UserFollowingService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch follower
			const follower = await this.getterService
				.getUser(ps.userId)
				.catch((err) => {
					if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
						throw new ApiError(meta.errors.noSuchUser);
					}
					throw err;
				});

			await this.userFollowingService.rejectFollowRequest(me, follower);

			return;
		});
	}
}
