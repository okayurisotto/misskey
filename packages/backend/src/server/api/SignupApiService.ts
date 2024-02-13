import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { NODE_ENV } from '@/env.js';
import { MetaService } from '@/core/MetaService.js';
import { CaptchaService } from '@/core/CaptchaService.js';
import { IdService } from '@/core/IdService.js';
import { SignupService } from '@/core/SignupService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { EmailService } from '@/core/EmailService.js';
import { LocalUser } from '@/models/entities/User.js';
import { FastifyReplyError } from '@/misc/fastify-reply-error.js';
import { L_CHARS, secureRndstr } from '@/misc/secure-rndstr.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { SigninService } from './SigninService.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { InviteCode } from '@prisma/client';

@Injectable()
export class SignupApiService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly metaService: MetaService,
		private readonly captchaService: CaptchaService,
		private readonly signupService: SignupService,
		private readonly signinService: SigninService,
		private readonly emailService: EmailService,
		private readonly prismaService: PrismaService,
	) {}

	public async signup(
		request: FastifyRequest<{
			Body: {
				username: string;
				password: string;
				host?: string;
				invitationCode?: string;
				emailAddress?: string;
				'hcaptcha-response'?: string;
				'g-recaptcha-response'?: string;
				'turnstile-response'?: string;
			}
		}>,
		reply: FastifyReply,
	): Promise<(z.infer<typeof UserDetailedSchema> & { token: string }) | void> {
		const body = request.body;

		const instance = await this.metaService.fetch();

		// Verify *Captcha
		// ただしテスト時はこの機構は障害となるため無効にする
		if (NODE_ENV !== 'test') {
			if (instance.enableHcaptcha && instance.hcaptchaSecretKey) {
				await this.captchaService.verifyHcaptcha(instance.hcaptchaSecretKey, body['hcaptcha-response']).catch(err => {
					throw new FastifyReplyError(400, err);
				});
			}

			if (instance.enableRecaptcha && instance.recaptchaSecretKey) {
				await this.captchaService.verifyRecaptcha(instance.recaptchaSecretKey, body['g-recaptcha-response']).catch(err => {
					throw new FastifyReplyError(400, err);
				});
			}

			if (instance.enableTurnstile && instance.turnstileSecretKey) {
				await this.captchaService.verifyTurnstile(instance.turnstileSecretKey, body['turnstile-response']).catch(err => {
					throw new FastifyReplyError(400, err);
				});
			}
		}

		const username = body['username'];
		const password = body['password'];
		const host: string | null = NODE_ENV === 'test' ? (body['host'] ?? null) : null;
		const invitationCode = body['invitationCode'];
		const emailAddress = body['emailAddress'];

		if (instance.emailRequiredForSignup) {
			if (emailAddress == null || typeof emailAddress !== 'string') {
				reply.code(400);
				return;
			}

			const res = await this.emailService.validateEmailForAccount(emailAddress);
			if (!res.available) {
				reply.code(400);
				return;
			}
		}

		let inviteCode: InviteCode | null = null;

		if (instance.disableRegistration) {
			if (invitationCode == null || typeof invitationCode !== 'string') {
				reply.code(400);
				return;
			}

			inviteCode = await this.prismaService.client.inviteCode.findUnique({
				where: {
					code: invitationCode,
				},
			});

			if (inviteCode == null) {
				reply.code(400);
				return;
			}

			if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
				reply.code(400);
				return;
			}

			if (inviteCode.usedAt) {
				reply.code(400);
				return;
			}
		}

		if (instance.emailRequiredForSignup) {
			if ((await this.prismaService.client.user.count({ where: { usernameLower: username.toLowerCase(), host: null }, take: 1 })) > 0) {
				throw new FastifyReplyError(400, 'DUPLICATED_USERNAME');
			}

			// Check deleted username duplication
			if ((await this.prismaService.client.usedUsername.count({ where: { username: username.toLowerCase() }, take: 1 })) > 0) {
				throw new FastifyReplyError(400, 'USED_USERNAME');
			}

			const isPreserved = instance.preservedUsernames.map(x => x.toLowerCase()).includes(username.toLowerCase());
			if (isPreserved) {
				throw new FastifyReplyError(400, 'DENIED_USERNAME');
			}

			const code = secureRndstr(16, { chars: L_CHARS });

			// Generate hash of password
			const salt = await bcrypt.genSalt(8);
			const hash = await bcrypt.hash(password, salt);

			const pendingUser = await this.prismaService.client.user_pending.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					code,
					email: emailAddress!,
					username: username,
					password: hash,
				},
			});

			const link = `${this.configLoaderService.data.url}/signup-complete/${code}`;

			this.emailService.sendEmail(emailAddress!, 'Signup',
				`To complete signup, please click this link:<br><a href="${link}">${link}</a>`,
				`To complete signup, please click this link: ${link}`);

			if (inviteCode) {
				await this.prismaService.client.inviteCode.update({
					where: { id: inviteCode.id },
					data: {
						usedAt: new Date(),
						pendingUserId: pendingUser.id,
					},
				});
			}

			reply.code(204);
			return;
		} else {
			try {
				const { account, secret } = await this.signupService.signup({
					username, password, host,
				});

				const res = await this.userEntityService.packDetailed(account, account, { includeSecrets: true });

				if (inviteCode) {
					await this.prismaService.client.inviteCode.update({
						where: { id: inviteCode.id },
						data: {
							usedAt: new Date(),
							usedById: account.id,
						},
					});
				}

				return {
					...res,
					token: secret,
				};
			} catch (err) {
				throw new FastifyReplyError(400, typeof err === 'string' ? err : (err as Error).toString());
			}
		}
	}

	public async signupPending(request: FastifyRequest<{ Body: { code: string; } }>, reply: FastifyReply): Promise<{ id: string; i: string | null }> {
		const body = request.body;

		const code = body['code'];

		try {
			const pendingUser = await this.prismaService.client.user_pending.findUniqueOrThrow({ where: { code } });

			const { account, secret } = await this.signupService.signup({
				username: pendingUser.username,
				passwordHash: pendingUser.password,
			});

			this.prismaService.client.user_pending.delete({
				where: {
					id: pendingUser.id,
				},
			});

			const profile = await this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: account.id } });

			await this.prismaService.client.user_profile.update({
				where: { userId: profile.userId },
				data: {
					email: pendingUser.email,
					emailVerified: true,
					emailVerifyCode: null,
				},
			});

			const inviteCode = await this.prismaService.client.inviteCode.findFirst({ where: { pendingUserId: pendingUser.id } });
			if (inviteCode) {
				await this.prismaService.client.inviteCode.update({
					where: { id: inviteCode.id },
					data: {
						usedById: account.id,
						pendingUserId: null,
					},
				});
			}

			return this.signinService.signin(request, reply, account as LocalUser);
		} catch (err) {
			throw new FastifyReplyError(400, typeof err === 'string' ? err : (err as Error).toString());
		}
	}
}
