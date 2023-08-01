import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown(); // TODO
export const meta = {
	requireCredential: true,
	requireAdmin: true,
	tags: ['admin'],
	res: generateSchema(res),
} as const;

const paramDef_ = z.unknown();
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.db)
		private db: DataSource,
	) {
		super(meta, paramDef_, async () => {
			const sizes = await this.db
				.query(
					`
			SELECT relname AS "table", reltuples as "count", pg_total_relation_size(C.oid) AS "size"
			FROM pg_class C LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
			WHERE nspname NOT IN ('pg_catalog', 'information_schema')
				AND C.relkind <> 'i'
				AND nspname !~ '^pg_toast';`,
				)
				.then((recs) => {
					const res = {} as Record<string, { count: number; size: number }>;
					for (const rec of recs) {
						res[rec.table] = {
							count: parseInt(rec.count, 10),
							size: parseInt(rec.size, 10),
						};
					}
					return res;
				});

			return sizes satisfies z.infer<typeof res>;
		});
	}
}
