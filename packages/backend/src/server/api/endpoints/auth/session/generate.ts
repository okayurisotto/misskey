import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { noSuchApp_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = z.object({
	token: z.string(),
	url: z.string(),
});
export const meta = {
	tags: ['auth'],
	requireCredential: false,
	res,
	errors: {noSuchApp:noSuchApp_},
} as const;

export const paramDef = z.object({
	appSecret: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			// Lookup app
			const app = await this.prismaService.client.app.findFirst({
				where: { secret: ps.appSecret },
			});

			if (app === null) {
				throw new ApiError(meta.errors.noSuchApp);
			}

			// Generate token
			const token = randomUUID();

			// Create session token document
			const doc = await this.prismaService.client.auth_session.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					appId: app.id,
					token: token,
				},
			});

			return {
				token: doc.token,
				url: `${this.config.authUrl}/${doc.token}`,
			};
		});
	}
}
