import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { noSuchAd } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { AdEntityService } from '@/core/entities/AdEntityService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: { noSuchAd: noSuchAd },
} as const;

export const paramDef = z.object({ id: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly adEntityService: AdEntityService) {
		super(meta, paramDef, async (ps) => {
			return this.adEntityService.delete(pick(ps, ['id']));
		});
	}
}
