import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RegistryItemsRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../../error.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	res,
	errors: {
		noSuchKey: {
			message: 'No such key.',
			code: 'NO_SUCH_KEY',
			id: '97a1e8e7-c0f7-47d2-957a-92e61256e01a',
		},
	},
} as const;

export const paramDef = z.object({
	key: z.string(),
	scope: z
		.array(z.string().regex(/^[a-zA-Z0-9_]+$/))
		.default([])
		.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.registryItemsRepository)
		private registryItemsRepository: RegistryItemsRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.registryItemsRepository
				.createQueryBuilder('item')
				.where('item.domain IS NULL')
				.andWhere('item.userId = :userId', { userId: me.id })
				.andWhere('item.key = :key', { key: ps.key })
				.andWhere('item.scope = :scope', { scope: ps.scope });

			const item = await query.getOne();

			if (item == null) {
				throw new ApiError(meta.errors.noSuchKey);
			}

			return {
				updatedAt: item.updatedAt,
				value: item.value,
			} satisfies z.infer<typeof res>;
		});
	}
}
