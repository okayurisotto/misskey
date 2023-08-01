import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ApResolverService } from '@/core/activitypub/ApResolverService.js';

const res = z.unknown();
export const meta = {
	tags: ['federation'],
	requireCredential: true,
	limit: {
		duration: ms('1hour'),
		max: 30,
	},
	errors: {},
	res,
} as const;

export const paramDef = z.object({
	uri: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private apResolverService: ApResolverService) {
		super(meta, paramDef, async (ps, me) => {
			const resolver = this.apResolverService.createResolver();
			const object = await resolver.resolve(ps.uri);
			return object satisfies z.infer<typeof res>;
		});
	}
}
