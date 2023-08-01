import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	UsersRepository,
	UserProfilesRepository,
} from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.object({
	password: z.string().min(8).max(8),
});
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
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

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef_, async (ps) => {
			const user = await this.usersRepository.findOneBy({ id: ps.userId });

			if (user == null) {
				throw new Error('user not found');
			}

			if (user.isRoot) {
				throw new Error('cannot reset password of root');
			}

			const passwd = secureRndstr(8);

			// Generate hash of password
			const hash = bcrypt.hashSync(passwd);

			await this.userProfilesRepository.update(
				{ userId: user.id },
				{ password: hash },
			);

			return {
				password: passwd,
			} satisfies z.infer<typeof res>;
		});
	}
}
