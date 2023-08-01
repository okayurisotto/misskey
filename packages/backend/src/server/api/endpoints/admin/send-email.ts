import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { EmailService } from '@/core/EmailService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({
	to: z.string(),
	subject: z.string(),
	text: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private emailService: EmailService) {
		super(meta, paramDef, async (ps, me) => {
			await this.emailService.sendEmail(ps.to, ps.subject, ps.text, ps.text);
		});
	}
}
