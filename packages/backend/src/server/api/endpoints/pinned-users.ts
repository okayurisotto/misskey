import { z } from 'zod';
import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository } from '@/models/index.js';
import * as Acct from '@/misc/acct.js';
import type { User } from '@/models/entities/User.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';

const res = z.array(UserDetailedSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private metaService: MetaService,
		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const meta = await this.metaService.fetch();

			const users = await Promise.all(
				meta.pinnedUsers
					.map((acct) => Acct.parse(acct))
					.map((acct) =>
						this.usersRepository.findOneBy({
							usernameLower: acct.username.toLowerCase(),
							host: acct.host ?? IsNull(),
						}),
					),
			);

			return (await Promise.all(
				users
					.filter((user): user is User => user !== null)
					.map((user) => this.userEntityService.pack(user, me, { detail: true }))
			)) satisfies z.infer<typeof res>;
		});
	}
}
