import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RelayService } from '@/core/RelayService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(
	z.object({
		id: MisskeyIdSchema,
		inbox: z.string().url(),
		status: z
			.enum(['requesting', 'accepted', 'rejected'])
			.default('requesting'),
	}),
);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.unknown();

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private relayService: RelayService) {
		super(meta, paramDef, async (ps, me) => {
			return (await this.relayService.listRelay()) satisfies z.infer<
				typeof res
			>;
		});
	}
}
