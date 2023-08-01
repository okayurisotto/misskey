import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import endpoints from '../endpoints.js';
import { generateOpenApiSpec } from 'zod2spec';

const res = z.unknown();
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
			return {
				params: Object.entries(generateOpenApiSpec([])(ep.params).properties ?? {}).map(([k, v]) => ({
					name: k,
					type: v.type
						? v.type.charAt(0).toUpperCase() + v.type.slice(1)
						: 'string',
				})),
			} satisfies z.infer<typeof res>;
		});
	}
}
