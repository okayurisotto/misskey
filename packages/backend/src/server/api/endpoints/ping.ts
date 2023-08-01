import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';

const res = z.object({
	pong: z.number(),
});
export const meta = {
	requireCredential: false,
	tags: ['meta'],
	res,
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor() {
		super(meta, paramDef, async () => {
			return {
				pong: Date.now(),
			} satisfies z.infer<typeof res>;
		});
	}
}
