import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import { AppLiteSchema, AppSecretOnlySchema } from '@/models/zod/AppSchema.js';
import { uniqueItems } from '@/models/zod/misc.js';

const res = AppLiteSchema.merge(AppSecretOnlySchema);
export const meta = {
	tags: ['app'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	name: z.string(),
	description: z.string(),
	callbackUrl: z.string().nullable().default(null),
	permission: uniqueItems(z.array(z.string())),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly appEntityService: AppEntityService) {
		super(meta, paramDef, async (ps, me) => {
			return await this.appEntityService.create(ps, me?.id ?? null);
		});
	}
}
