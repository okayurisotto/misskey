import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AccessTokensRepository } from '@/models/index.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

export const meta = {
	requireCredential: true,
	secure: true,
} as const;

export const paramDef = z.object({
	tokenId: misskeyIdPattern,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.accessTokensRepository)
		private accessTokensRepository: AccessTokensRepository,

		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const tokenExist = await this.accessTokensRepository.exist({
				where: { id: ps.tokenId },
			});

			if (tokenExist) {
				await this.accessTokensRepository.delete({
					id: ps.tokenId,
					userId: me.id,
				});
			}
		});
	}
}
