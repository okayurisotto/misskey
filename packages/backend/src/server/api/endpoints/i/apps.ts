import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AccessTokensRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	sort: z
		.enum(['+createdAt', '-createdAt', '+lastUsedAt', '-lastUsedAt'])
		.optional(),
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
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.accessTokensRepository
				.createQueryBuilder('token')
				.where('token.userId = :userId', { userId: me.id })
				.leftJoinAndSelect('token.app', 'app');

			switch (ps.sort) {
				case '+createdAt':
					query.orderBy('token.createdAt', 'DESC');
					break;
				case '-createdAt':
					query.orderBy('token.createdAt', 'ASC');
					break;
				case '+lastUsedAt':
					query.orderBy('token.lastUsedAt', 'DESC');
					break;
				case '-lastUsedAt':
					query.orderBy('token.lastUsedAt', 'ASC');
					break;
				default:
					query.orderBy('token.id', 'ASC');
					break;
			}

			const tokens = await query.getMany();

			return await Promise.all(
				tokens.map((token) => ({
					id: token.id,
					name: token.name ?? token.app?.name,
					createdAt: token.createdAt,
					lastUsedAt: token.lastUsedAt,
					permission: token.permission,
				})),
			) satisfies z.infer<typeof res>;
		});
	}
}
