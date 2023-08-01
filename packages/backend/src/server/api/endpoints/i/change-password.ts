import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { UserProfilesRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	requireCredential: true,
	secure: true,
} as const;

export const paramDef = z.object({
	currentPassword: z.string(),
	newPassword: z.string().min(1),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({
				userId: me.id,
			});

			// Compare password
			const same = await bcrypt.compare(ps.currentPassword, profile.password!);

			if (!same) {
				throw new Error('incorrect password');
			}

			// Generate hash of password
			const salt = await bcrypt.genSalt(8);
			const hash = await bcrypt.hash(ps.newPassword, salt);

			await this.userProfilesRepository.update(me.id, {
				password: hash,
			});
		});
	}
}
