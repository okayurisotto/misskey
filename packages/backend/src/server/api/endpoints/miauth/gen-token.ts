import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { uniqueItems } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({
	token: z.string(),
});
export const meta = {
	tags: ['auth'],
	requireCredential: true,
	secure: true,
	res,
} as const;

export const paramDef = z.object({
	session: z.string().nullable(),
	name: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	iconUrl: z.string().nullable().optional(),
	permission: uniqueItems(z.array(z.string())),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Generate access token
			const accessToken = secureRndstr(32);

			const now = new Date();

			// Insert access token doc
			await this.prismaService.client.accessToken.create({
				data: {
					id: this.idService.genId(),
					createdAt: now,
					lastUsedAt: now,
					session: ps.session,
					userId: me.id,
					token: accessToken,
					hash: accessToken,
					name: ps.name,
					description: ps.description,
					iconUrl: ps.iconUrl,
					permission: ps.permission,
				},
			});

			return {
				token: accessToken,
			};
		});
	}
}
