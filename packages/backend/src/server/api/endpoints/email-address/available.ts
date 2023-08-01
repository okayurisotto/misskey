import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { EmailService } from '@/core/EmailService.js';

const res = z.object({
	available: z.boolean(),
	reason: z.string().nullable(),
});
export const meta = {
	tags: ['users'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	emailAddress: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private emailService: EmailService) {
		super(meta, paramDef, async (ps, me) => {
			return (await this.emailService.validateEmailForAccount(
				ps.emailAddress,
			)) satisfies z.infer<typeof res>;
		});
	}
}
