import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import endpoints from '../endpoints.js';
import { generateOpenApiSpec } from 'zod2spec';

const res = z.object({ spec: z.unknown() }).nullable();
export const meta = {
	requireCredential: false,
	tags: ['meta'],
	res,
} as const;

export const paramDef = z.object({
	endpoint: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor() {
		super(meta, paramDef, async (ps) => {
			const ep = endpoints.find((x) => x.name === ps.endpoint);
			if (ep == null) return null satisfies z.infer<typeof res>;
			const spec = generateOpenApiSpec([])(ep.params);
			return { spec } satisfies z.infer<typeof res>;
		});
	}
}
