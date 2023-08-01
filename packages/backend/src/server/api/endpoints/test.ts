import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.unknown();
export const meta = {
	tags: ['non-productive'],
	description: 'Endpoint for testing input validation.',
	requireCredential: false,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	required: z.boolean(),
	string: z.string().optional(),
	default: z.string().default('hello'),
	nullableDefault: z.string().nullable().default('hello'),
	id: misskeyIdPattern.optional(),
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
		super(meta, paramDef_, async (ps, me) => {
			return ps satisfies z.infer<typeof res>;
		});
	}
}
