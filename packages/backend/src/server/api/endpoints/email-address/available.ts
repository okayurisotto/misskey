import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	emailAddress: z.string(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(private emailService: EmailService) {
		super(meta, paramDef_, async (ps, me) => {
			return (await this.emailService.validateEmailForAccount(
				ps.emailAddress,
			)) satisfies z.infer<typeof res>;
		});
	}
}
