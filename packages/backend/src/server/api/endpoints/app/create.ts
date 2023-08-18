import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { unique } from '@/misc/prelude/array.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import { AppSchema } from '@/models/zod/AppSchema.js';
import { uniqueItems } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = AppSchema;
export const meta = {
	tags: ['app'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	name: z.string(),
	description: z.string(),
	permission: uniqueItems(z.array(z.string())),
	callbackUrl: z.string().nullable().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly appEntityService: AppEntityService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Generate secret
			const secret = secureRndstr(32);

			// for backward compatibility
			const permission = unique(
				ps.permission.map((v) =>
					v.replace(/^(.+)(\/|-)(read|write)$/, '$3:$1'),
				),
			);

			// Create account
			const app = await this.prismaService.client.app.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me ? me.id : null,
					name: ps.name,
					description: ps.description,
					permission,
					callbackUrl: ps.callbackUrl,
					secret: secret,
				},
			});

			return await this.appEntityService.pack(app, null, {
				detail: true,
				includeSecret: true,
			});
		});
	}
}
