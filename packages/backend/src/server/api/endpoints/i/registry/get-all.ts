import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RegistryItemsRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	res,
} as const;

export const paramDef = z.object({
	scope: z.array(z.string().regex(/^[a-zA-Z0-9_]+$/)).optional(),
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
				.andWhere('item.scope = :scope', { scope: ps.scope });

			const items = await query.getMany();

			const res_ = {} as Record<string, any>;

			for (const item of items) {
				res_[item.key] = item.value;
			}

			return res_ satisfies z.infer<typeof res>;
		});
	}
}
