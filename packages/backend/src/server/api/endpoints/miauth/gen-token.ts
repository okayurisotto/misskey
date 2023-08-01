import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AccessTokensRepository } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { DI } from '@/di-symbols.js';
import { uniqueItems } from '@/models/zod/misc.js';

const res = z.object({
	token: z.string(),
});
export const meta = {
	tags: ['auth'],
	requireCredential: true,
	secure: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	session: z.string().nullable(),
	name: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	iconUrl: z.string().nullable().optional(),
	permission: uniqueItems(z.array(z.string())),
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
		@Inject(DI.accessTokensRepository)
		private accessTokensRepository: AccessTokensRepository,

		private idService: IdService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			// Generate access token
			const accessToken = secureRndstr(32);

			const now = new Date();

			// Insert access token doc
			await this.accessTokensRepository.insert({
				id: this.idService.genId(),
				createdAt: now,
				lastUsedAt: now,
				session: ps.session,
				userId: me.id,
				token: accessToken,
				hash: accessToken,
				name: ps.name,
				description: ps.description,
				iconUrl: ps.iconUrl,
				permission: ps.permission,
			});

			return {
				token: accessToken,
			} satisfies z.infer<typeof res>;
		});
	}
}
