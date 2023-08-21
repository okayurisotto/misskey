import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchUser________, followRequestNotFound } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = UserLiteSchema;
export const meta = {
	tags: ['following', 'account'],
	requireCredential: true,
	kind: 'write:following',
	errors: {noSuchUser:noSuchUser________,followRequestNotFound:followRequestNotFound},
	res,
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private userEntityService: UserEntityService,
		private getterService: GetterService,
		private userFollowingService: UserFollowingService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch followee
			const followee = await this.getterService
				.getUser(ps.userId)
				.catch((err) => {
					if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
						throw new ApiError(meta.errors.noSuchUser);
					}
					throw err;
				});

			try {
				await this.userFollowingService.cancelFollowRequest(followee, me);
			} catch (err) {
				if (err instanceof IdentifiableError) {
					if (err.id === '17447091-ce07-46dd-b331-c1fd4f15b1e7') {
						throw new ApiError(meta.errors.followRequestNotFound);
					}
				}
				throw err;
			}

			return (await this.userEntityService.packLite(followee.id)) satisfies z.infer<typeof res>;
		});
	}
}
