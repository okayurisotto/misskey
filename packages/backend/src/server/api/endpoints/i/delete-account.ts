import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import bcrypt from 'bcryptjs';
import { Inject, Injectable } from '@nestjs/common';
import type {
	UsersRepository,
	UserProfilesRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DeleteAccountService } from '@/core/DeleteAccountService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	requireCredential: true,
	secure: true,
} as const;

const paramDef_ = z.object({
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
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private deleteAccountService: DeleteAccountService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({
				userId: me.id,
			});
			const userDetailed = await this.usersRepository.findOneByOrFail({
				id: me.id,
			});
			if (userDetailed.isDeleted) {
				return;
			}

			// Compare password
			const same = await bcrypt.compare(ps.password, profile.password!);

			if (!same) {
				throw new Error('incorrect password');
			}

			await this.deleteAccountService.deleteAccount(me);
		});
	}
}
