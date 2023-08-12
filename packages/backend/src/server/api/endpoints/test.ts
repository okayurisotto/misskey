import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.object({
	required: z.boolean(),
	string: z.string().optional(),
	default: z.string().default('hello'),
	nullableDefault: z.string().nullable().default('hello'),
	id: MisskeyIdSchema.optional(),
});
export const meta = {
	tags: ['non-productive'],
	description: 'Endpoint for testing input validation.',
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	required: z.boolean(),
	string: z.string().optional(),
	default: z.string().default('hello'),
	nullableDefault: z.string().nullable().default('hello'),
	id: MisskeyIdSchema.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor() {
		super(meta, paramDef, async (ps, me) => {
			return ps satisfies z.infer<typeof res>;
		});
	}
}
