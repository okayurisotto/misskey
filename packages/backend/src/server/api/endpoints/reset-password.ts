import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import bcrypt from 'bcryptjs';
import { Inject, Injectable } from '@nestjs/common';
import type {
	UserProfilesRepository,
	PasswordResetRequestsRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['reset password'],
	requireCredential: false,
	description: 'Complete the password reset that was previously requested.',
	errors: {},
} as const;

const paramDef_ = z.object({
	token: z.string(),
	password: z.string(),
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
		@Inject(DI.passwordResetRequestsRepository)
		private passwordResetRequestsRepository: PasswordResetRequestsRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const req = await this.passwordResetRequestsRepository.findOneByOrFail({
				token: ps.token,
			});

			// 発行してから30分以上経過していたら無効
			if (Date.now() - req.createdAt.getTime() > 1000 * 60 * 30) {
				throw new Error(); // TODO
			}

			// Generate hash of password
			const salt = await bcrypt.genSalt(8);
			const hash = await bcrypt.hash(ps.password, salt);

			await this.userProfilesRepository.update(req.userId, {
				password: hash,
			});

			this.passwordResetRequestsRepository.delete(req.id);
		});
	}
}
