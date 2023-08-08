import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

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
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const items = await this.prismaService.client.registry_item.findMany({
				where: {
					domain: null,
					userId: me.id,
					scope: { equals: ps.scope },
				},
			});

			const res_ = items.reduce<Record<string, unknown>>(
				(acc, cur) => ({ ...acc, [cur.key]: cur.value }),
				{},
			);

			return res_ satisfies z.infer<typeof res>;
		});
	}
}
