import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';

const res = z.object({
	pong: z.number(),
});
export const meta = {
	requireCredential: false,
	tags: ['meta'],
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor() {
		super(meta, paramDef_, async () => {
			return {
				pong: Date.now(),
			} satisfies z.infer<typeof res>;
		});
	}
}
