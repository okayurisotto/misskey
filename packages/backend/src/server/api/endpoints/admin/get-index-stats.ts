import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown(); // TODO
export const meta = {
	requireCredential: true,
	requireAdmin: true,
	tags: ['admin'],
	res,
} as const;

export const paramDef = z.unknown();

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.db)
		private db: DataSource,
	) {
		super(meta, paramDef, async () => {
			const stats = await this.db
				.query('SELECT * FROM pg_indexes;')
				.then((recs) => {
					const res = [] as { tablename: string; indexname: string }[];
					for (const rec of recs) {
						res.push(rec);
					}
					return res;
				});

			return stats satisfies z.infer<typeof res>;
		});
	}
}
