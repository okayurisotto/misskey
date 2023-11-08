import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';
import type { DataSource } from 'typeorm';

export const resetDb = async (db: DataSource): Promise<void> => {
	const reset = async (): Promise<void> => {
		const tables_ = await db.query(`
			SELECT relname AS "table"
				FROM pg_class C LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
				WHERE nspname NOT IN ('pg_catalog', 'information_schema')
					AND C.relkind = 'r'
					AND nspname !~ '^pg_toast';
		`);
		const tables = z.array(z.object({ table: z.string() })).parse(tables_);

		for (const { table } of tables) {
			await db.query(`DELETE FROM "${table}" CASCADE`);
		}
	};

	const maxRetries = 3;

	for (let count = 1; count <= maxRetries; count++) {
		try {
			await reset();
		} catch (e) {
			if (count === maxRetries) {
				throw e;
			} else {
				await setTimeout(1000);
				continue;
			}
		}
		break;
	}
};
