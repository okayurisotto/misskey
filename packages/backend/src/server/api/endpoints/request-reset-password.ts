import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { EmailService } from '@/core/EmailService.js';
import { L_CHARS, secureRndstr } from '@/misc/secure-rndstr.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

export const meta = {
	tags: ['reset password'],
	requireCredential: false,
	description: 'Request a users password to be reset.',
	limit: {
		duration: ms('1hour'),
		max: 3,
	},
} as const;

export const paramDef = z.object({
	username: z.string(),
	email: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		private readonly idService: IdService,
		private readonly emailService: EmailService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const user = await this.prismaService.client.user.findFirst({
				where: {
					usernameLower: ps.username.toLowerCase(),
					host: null,
				},
			});

			// 合致するユーザーが登録されていなかったら無視
			if (user == null) {
				return;
			}

			const profile =
				await this.prismaService.client.user_profile.findUniqueOrThrow({
					where: { userId: user.id },
				});

			// 合致するメアドが登録されていなかったら無視
			if (profile.email !== ps.email) {
				return;
			}

			// メアドが認証されていなかったら無視
			if (!profile.emailVerified) {
				return;
			}

			const token = secureRndstr(64, { chars: L_CHARS });

			await this.prismaService.client.passwordResetRequest.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: profile.userId,
					token,
				},
			});

			const link = `${this.configLoaderService.data.url}/reset-password/${token}`;

			this.emailService.sendEmail(
				ps.email,
				'Password reset requested',
				`To reset password, please click this link:<br><a href="${link}">${link}</a>`,
				`To reset password, please click this link: ${link}`,
			);
		});
	}
}
