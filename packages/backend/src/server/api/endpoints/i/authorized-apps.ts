import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { IsNull, Not } from 'typeorm';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AccessTokensRepository } from '@/models/index.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	offset: z.number().int().default(0),
	sort: z.enum(['desc', 'asc']).default('desc'),
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

		private appEntityService: AppEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			// Get tokens
			const tokens = await this.accessTokensRepository.find({
				where: {
					userId: me.id,
					appId: Not(IsNull()),
				},
				take: ps.limit,
				skip: ps.offset,
				order: {
					id: ps.sort === 'asc' ? 1 : -1,
				},
			});

			return await Promise.all(
				tokens.map((token) =>
					this.appEntityService.pack(token.appId!, me, {
						detail: true,
					}),
				),
			) satisfies z.infer<typeof res>;
		});
	}
}
