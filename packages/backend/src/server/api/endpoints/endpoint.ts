import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import endpoints from '../endpoints.js';

const res = z.unknown();
export const meta = {
	requireCredential: false,
	tags: ['meta'],
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	endpoint: z.string(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor() {
		super(meta, paramDef_, async (ps) => {
			const ep = endpoints.find((x) => x.name === ps.endpoint);
			if (ep == null) return null satisfies z.infer<typeof res>;
			return {
				params: Object.entries(ep.params.properties ?? {}).map(([k, v]) => ({
					name: k,
					type: v.type
						? v.type.charAt(0).toUpperCase() + v.type.slice(1)
						: 'string',
				})),
			} satisfies z.infer<typeof res>;
		});
	}
}
