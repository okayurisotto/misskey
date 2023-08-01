import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DeleteAccountService } from '@/core/DeleteAccountService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
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
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private deleteAccountService: DeleteAccountService,
	) {
		super(meta, paramDef_, async (ps) => {
			const user = await this.usersRepository.findOneByOrFail({
				id: ps.userId,
			});
			if (user.isDeleted) {
				return;
			}

			await this.deleteAccountService.deleteAccount(user);
		});
	}
}
