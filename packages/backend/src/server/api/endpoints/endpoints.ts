import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import endpoints from '../endpoints.js';

const res = z.array(z.string());
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
			return endpoints.map((x) => x.name);
		});
	}
}
