import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RelayService } from '@/core/RelayService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(
	z.object({
		id: misskeyIdPattern,
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
	res: generateSchema(res),
} as const;

const paramDef_ = z.unknown();
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(private relayService: RelayService) {
		super(meta, paramDef_, async (ps, me) => {
			return (await this.relayService.listRelay()) satisfies z.infer<
				typeof res
			>;
		});
	}
}
