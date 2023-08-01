import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { EmailService } from '@/core/EmailService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

const paramDef_ = z.object({
	to: z.string(),
	subject: z.string(),
	text: z.string(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(private emailService: EmailService) {
		super(meta, paramDef_, async (ps, me) => {
			await this.emailService.sendEmail(ps.to, ps.subject, ps.text, ps.text);
		});
	}
}
