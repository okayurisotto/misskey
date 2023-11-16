import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(z.array(z.string()));
export const meta = {
	requireCredential: true,
	secure: true,
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
		super(meta, paramDef, async (ps, me) => {
			const items = await this.prismaService.client.registry_item.findMany({
				where: { domain: null, userId: me.id },
			});

			const res_: string[][] = [];

			for (const item of items) {
				if (res_.some((scope) => scope.join('.') === item.scope.join('.'))) {
					continue;
				}
				res_.push(item.scope);
			}

			return res_;
		});
	}
}
