import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { UsersRepository } from '@/models/index.js';
import { SignupService } from '@/core/SignupService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { PasswordSchema, LocalUsernameSchema } from '@/models/zod/misc.js';

const res = UserDetailedSchema; // TODO
// {
// 		type: 'object',
// 		optional: false, nullable: false,
// 		ref: 'User',
// 		properties: {
// 			token: {
// 				type: 'string',
// 				optional: false, nullable: false,
// 			},
// 		},
// 	}
export const meta = {
	tags: ['admin'],

	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	username: LocalUsernameSchema,
	password: PasswordSchema,
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

		private userEntityService: UserEntityService,
		private signupService: SignupService,
	) {
		super(meta, paramDef_, async (ps, _me) => {
			const me = _me
				? await this.usersRepository.findOneByOrFail({ id: _me.id })
				: null;
			const noUsers =
				(await this.usersRepository.countBy({
					host: IsNull(),
				})) === 0;
			if (!noUsers && !me?.isRoot) throw new Error('access denied');

			const { account, secret } = await this.signupService.signup({
				username: ps.username,
				password: ps.password,
				ignorePreservedUsernames: true,
			});

			const res_ = await this.userEntityService.pack(account, account, {
				detail: true,
				includeSecrets: true,
			});

			(res_ as any).token = secret;

			return res_ satisfies z.infer<typeof res>;
		});
	}
}
