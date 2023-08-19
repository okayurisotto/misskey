import { incorrectPassword, unavailable } from '@/server/api/errors.js';
import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import bcrypt from 'bcryptjs';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { EmailService } from '@/core/EmailService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { L_CHARS, secureRndstr } from '@/misc/secure-rndstr.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = z.record(z.string(), z.unknown());
export const meta = {
	requireCredential: true,
	secure: true,
	limit: {
		duration: ms('1hour'),
		max: 3,
	},
	res,
	errors: {incorrectPassword:incorrectPassword,unavailable:unavailable},
} as const;

export const paramDef = z.object({
	password: z.string(),
	email: z.string().nullable().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.config)
		private readonly config: Config,

		private readonly userEntityService: UserEntityService,
		private readonly emailService: EmailService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile =
				await this.prismaService.client.user_profile.findUniqueOrThrow({
					where: { userId: me.id },
				});

			// Compare password
			const same = await bcrypt.compare(ps.password, profile.password!);

			if (!same) {
				throw new ApiError(meta.errors.incorrectPassword);
			}

			if (ps.email != null) {
				const res = await this.emailService.validateEmailForAccount(ps.email);
				if (!res.available) {
					throw new ApiError(meta.errors.unavailable);
				}
			}

			await this.prismaService.client.user_profile.update({
				where: { userId: me.id },
				data: {
					email: ps.email,
					emailVerified: false,
					emailVerifyCode: null,
				},
			});

			const iObj = await this.userEntityService.packDetailed(me.id, me, { includeSecrets: true });

			// Publish meUpdated event
			this.globalEventService.publishMainStream(me.id, 'meUpdated', iObj);

			if (ps.email != null) {
				const code = secureRndstr(16, { chars: L_CHARS });

				await this.prismaService.client.user_profile.update({
					where: { userId: me.id },
					data: { emailVerifyCode: code },
				});

				const link = `${this.config.url}/verify-email/${code}`;

				this.emailService.sendEmail(
					ps.email,
					'Email verification',
					`To verify email, please click this link:<br><a href="${link}">${link}</a>`,
					`To verify email, please click this link: ${link}`,
				);
			}

			return iObj satisfies z.infer<typeof res>;
		});
	}
}
