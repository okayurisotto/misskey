import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(
	z.object({
		tablename: z.string(),
		indexname: z.string(),
	}),
);
export const meta = {
	requireCredential: true,
	requireAdmin: true,
	tags: ['admin'],
	res,
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async () => {
			const result = await this.prismaService.client
				.$queryRaw`SELECT * FROM pg_indexes;`;

			const stats = z
				.array(z.object({ tablename: z.string(), indexname: z.string() }))
				.parse(result);

			return stats satisfies z.infer<typeof res>;
		});
	}
}
