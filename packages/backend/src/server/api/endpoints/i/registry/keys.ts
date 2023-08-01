import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RegistryItemsRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	scope: z
		.array(z.string().regex(/^[a-zA-Z0-9_]+$/))
		.default([])
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
		@Inject(DI.registryItemsRepository)
		private registryItemsRepository: RegistryItemsRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.registryItemsRepository
				.createQueryBuilder('item')
				.select('item.key')
				.where('item.domain IS NULL')
				.andWhere('item.userId = :userId', { userId: me.id })
				.andWhere('item.scope = :scope', { scope: ps.scope });

			const items = await query.getMany();

			return items.map((x) => x.key) satisfies z.infer<typeof res>;
		});
	}
}
