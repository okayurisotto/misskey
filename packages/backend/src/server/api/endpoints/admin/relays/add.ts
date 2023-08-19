import { invalidUrl } from '@/server/api/errors.js';
import { URL } from 'node:url';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RelayService } from '@/core/RelayService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = z.object({
	id: MisskeyIdSchema,
	inbox: z.string().url(),
	status: z.enum(['requesting', 'accepted', 'rejected']).default('requesting'),
});
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {invalidUrl:invalidUrl},
	res,
} as const;

export const paramDef = z.object({
	inbox: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private relayService: RelayService) {
		super(meta, paramDef, async (ps) => {
			if (new URL(ps.inbox).protocol !== 'https:') {
				throw new ApiError(meta.errors.invalidUrl);
			}

			return await this.relayService.addRelay(ps.inbox);
		});
	}
}
