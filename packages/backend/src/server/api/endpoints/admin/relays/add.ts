import { URL } from 'node:url';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RelayService } from '@/core/RelayService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = z.object({
	id: misskeyIdPattern,
	inbox: z.string().url(),
	status: z.enum(['requesting', 'accepted', 'rejected']).default('requesting'),
});
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		invalidUrl: {
			message: 'Invalid URL',
			code: 'INVALID_URL',
			id: 'fb8c92d3-d4e5-44e7-b3d4-800d5cef8b2c',
		},
	},
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
		super(meta, paramDef, async (ps, me) => {
			try {
				if (new URL(ps.inbox).protocol !== 'https:') {
					throw new Error('https only');
				}
			} catch {
				throw new ApiError(meta.errors.invalidUrl);
			}

			return (await this.relayService.addRelay(ps.inbox)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
