import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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

const paramDef_ = z.object({
	tokenId: misskeyIdPattern,
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
		@Inject(DI.accessTokensRepository)
		private accessTokensRepository: AccessTokensRepository,

		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef_, async (ps, me) => {
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
