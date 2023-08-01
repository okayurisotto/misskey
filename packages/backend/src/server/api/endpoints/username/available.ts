import { z } from 'zod';
import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type {
	UsedUsernamesRepository,
	UsersRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { MetaService } from '@/core/MetaService.js';
import { LocalUsernameSchema } from '@/models/zod/misc.js';

const res = z.object({
	available: z.boolean(),
});
export const meta = {
	tags: ['users'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	username: LocalUsernameSchema,
});

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

		@Inject(DI.usedUsernamesRepository)
		private usedUsernamesRepository: UsedUsernamesRepository,

		private metaService: MetaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const exist = await this.usersRepository.countBy({
				host: IsNull(),
				usernameLower: ps.username.toLowerCase(),
			});

			const exist2 = await this.usedUsernamesRepository.countBy({
				username: ps.username.toLowerCase(),
			});

			const meta = await this.metaService.fetch();
			const isPreserved = meta.preservedUsernames
				.map((x) => x.toLowerCase())
				.includes(ps.username.toLowerCase());

			return {
				available: exist === 0 && exist2 === 0 && !isPreserved,
			} satisfies z.infer<typeof res>;
		});
	}
}
