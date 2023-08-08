import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	res,
} as const;

export const paramDef = z.object({
	sort: z
		.enum(['+createdAt', '-createdAt', '+lastUsedAt', '-lastUsedAt'])
		.optional(),
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
			const orderBy = ((): Prisma.access_tokenOrderByWithRelationInput => {
				switch (ps.sort) {
					case '+createdAt':
						return { createdAt: 'desc' };
					case '-createdAt':
						return { createdAt: 'asc' };
					case '+lastUsedAt':
						return { lastUsedAt: 'desc' };
					case '-lastUsedAt':
						return { lastUsedAt: 'asc' };
					default:
						return { id: 'asc' };
				}
			})();

			const tokens = await this.prismaService.client.access_token.findMany({
				where: { userId: me.id },
				orderBy,
			});

			return (await Promise.all(
				tokens.map((token) => ({
					id: token.id,
					name: token.name ?? token.app?.name,
					createdAt: token.createdAt,
					lastUsedAt: token.lastUsedAt,
					permission: token.permission,
				})),
			)) satisfies z.infer<typeof res>;
		});
	}
}
