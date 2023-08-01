import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['following', 'account'],
	requireCredential: true,
	kind: 'write:following',
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '66ce1645-d66c-46bb-8b79-96739af885bd',
		},
		noFollowRequest: {
			message: 'No follow request.',
			code: 'NO_FOLLOW_REQUEST',
			id: 'bcde4f8b-0913-4614-8881-614e522fb041',
		},
	},
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
		private getterService: GetterService,
		private userFollowingService: UserFollowingService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			// Fetch follower
			const follower = await this.getterService
				.getUser(ps.userId)
				.catch((err) => {
					if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
						throw new ApiError(meta.errors.noSuchUser);
					}
					throw err;
				});

			await this.userFollowingService
				.acceptFollowRequest(me, follower)
				.catch((err) => {
					if (err.id === '8884c2dd-5795-4ac9-b27e-6a01d38190f9') {
						throw new ApiError(meta.errors.noFollowRequest);
					}
					throw err;
				});

			return;
		});
	}
}
