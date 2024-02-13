import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import type { Prisma } from '@prisma/client';

const res = z.array(
	z.object({
		id: MisskeyIdSchema,
		name: z.string().optional(),
		createdAt: z.unknown(),
		lastUsedAt: z.unknown(),
		permission: z.array(z.string()),
	}),
);
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
			const orderBy = ((): Prisma.AccessTokenOrderByWithRelationInput => {
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

			const tokens = await this.prismaService.client.accessToken.findMany({
				where: { userId: me.id },
				orderBy,
				include: { app: true },
			});

			return await Promise.all(
				tokens.map((token) => ({
					id: token.id,
					name: token.name ?? token.app?.name,
					createdAt: token.createdAt,
					lastUsedAt: token.lastUsedAt,
					permission: token.permission,
				})),
			);
		});
	}
}
