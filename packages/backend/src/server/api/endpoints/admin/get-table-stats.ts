import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

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
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async () => {
			const result = await this.prismaService.client.$queryRaw`
				SELECT relname AS "table", reltuples as "count", pg_total_relation_size(C.oid) AS "size"
				FROM pg_class C LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
				WHERE nspname NOT IN ('pg_catalog', 'information_schema')
					AND C.relkind <> 'i'
					AND nspname !~ '^pg_toast';
			`;

			const sizes = z
				.array(
					z.object({
						table: z.string(),
						count: z.union([z.number(), z.bigint()]),
						size: z.union([z.number(), z.bigint()]),
					}),
				)
				.parse(result)
				.reduce<Record<string, { count: number; size: number }>>((acc, cur) => {
					acc[cur.table] = {
						count: Number(cur.count),
						size: Number(cur.size),
					};
					return acc;
				}, {});

			return sizes satisfies z.infer<typeof res>;
		});
	}
}
