import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import bcrypt from 'bcryptjs';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	UsersRepository,
	UserProfilesRepository,
} from '@/models/index.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { EmailService } from '@/core/EmailService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { L_CHARS, secureRndstr } from '@/misc/secure-rndstr.js';
import { ApiError } from '../../error.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	limit: {
		duration: ms('1hour'),
		max: 3,
	},
	res: generateSchema(res),
	errors: {
		incorrectPassword: {
			message: 'Incorrect password.',
			code: 'INCORRECT_PASSWORD',
			id: 'e54c1d7e-e7d6-4103-86b6-0a95069b4ad3',
		},
		unavailable: {
			message: 'Unavailable email address.',
			code: 'UNAVAILABLE',
			id: 'a2defefb-f220-8849-0af6-17f816099323',
		},
	},
} as const;

const paramDef_ = z.object({
	password: z.string(),
	email: z.string().nullable().optional(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,
		private emailService: EmailService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({
				userId: me.id,
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

			await this.userProfilesRepository.update(me.id, {
				email: ps.email,
				emailVerified: false,
				emailVerifyCode: null,
			});

			const iObj = await this.userEntityService.pack(me.id, me, {
				detail: true,
				includeSecrets: true,
			});

			// Publish meUpdated event
			this.globalEventService.publishMainStream(me.id, 'meUpdated', iObj);

			if (ps.email != null) {
				const code = secureRndstr(16, { chars: L_CHARS });

				await this.userProfilesRepository.update(me.id, {
					emailVerifyCode: code,
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
