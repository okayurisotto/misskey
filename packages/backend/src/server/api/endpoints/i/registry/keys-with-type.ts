import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.record(z.string(), z.string());
export const meta = {
	requireCredential: true,
	secure: true,
	res,
} as const;

export const paramDef = z.object({
	scope: z.array(z.string().regex(/^[a-zA-Z0-9_]+$/)).default([]),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const items = await this.prismaService.client.registry_item.findMany({
				where: {
					domain: null,
					userId: me.id,
					scope: { equals: ps.scope },
				},
			});

			const res_ = items.reduce<Record<string, string>>((acc, cur) => {
				return {
					...acc,
					[cur.key]:
						cur.value === null
							? 'null'
							: Array.isArray(cur.value)
							? 'array'
							: typeof cur.value === 'number'
							? 'number'
							: typeof cur.value === 'string'
							? 'string'
							: typeof cur.value === 'boolean'
							? 'boolean'
							: typeof cur.value === 'object'
							? 'object'
							: (null as never),
				};
			}, {});

			return res_;
		});
	}
}
