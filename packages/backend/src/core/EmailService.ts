import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';
import { validate as validateEmail } from 'deep-email-validator';
import { MetaService } from '@/core/MetaService.js';
import Logger from '@/misc/logger.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

@Injectable()
export class EmailService {
	private readonly logger = new Logger('email');

	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
	) {}

	public async sendEmail(
		to: string,
		subject: string,
		html: string,
		text: string,
	): Promise<void> {
		const meta = await this.metaService.fetch();

		const iconUrl = `${this.configLoaderService.data.url}/static-assets/mi-white.png`;
		const emailSettingUrl = `${this.configLoaderService.data.url}/settings/email`;

		const enableAuth = meta.smtpUser != null && meta.smtpUser !== '';

		const transporter = nodemailer.createTransport({
			host: meta.smtpHost,
			port: meta.smtpPort,
			secure: meta.smtpSecure,
			ignoreTLS: !enableAuth,
			proxy: this.configLoaderService.data.proxySmtp,
			auth: enableAuth
				? {
						user: meta.smtpUser,
						pass: meta.smtpPass,
				  }
				: undefined,
		} satisfies SMTPTransport.Options);

		try {
			// TODO: htmlサニタイズ
			const info = await transporter.sendMail({
				from: meta.email!,
				to: to,
				subject: subject,
				text: text,
				html: `<!doctype html>
<html>
	<head>
		<meta charset="utf-8">
		<title>${subject}</title>
		<style>
			html {
				background: #eee;
			}

			body {
				padding: 16px;
				margin: 0;
				font-family: sans-serif;
				font-size: 14px;
			}

			a {
				text-decoration: none;
				color: #86b300;
			}
			a:hover {
				text-decoration: underline;
			}

			main {
				max-width: 500px;
				margin: 0 auto;
				background: #fff;
				color: #555;
			}
				main > header {
					padding: 32px;
					background: #86b300;
				}
					main > header > img {
						max-width: 128px;
						max-height: 28px;
						vertical-align: bottom;
					}
				main > article {
					padding: 32px;
				}
					main > article > h1 {
						margin: 0 0 1em 0;
					}
				main > footer {
					padding: 32px;
					border-top: solid 1px #eee;
				}

			nav {
				box-sizing: border-box;
				max-width: 500px;
				margin: 16px auto 0 auto;
				padding: 0 32px;
			}
				nav > a {
					color: #888;
				}
		</style>
	</head>
	<body>
		<main>
			<header>
				<img src="${meta.logoImageUrl ?? meta.iconUrl ?? iconUrl}"/>
			</header>
			<article>
				<h1>${subject}</h1>
				<div>${html}</div>
			</article>
			<footer>
				<a href="${emailSettingUrl}">${'Email setting'}</a>
			</footer>
		</main>
		<nav>
			<a href="${this.configLoaderService.data.url}">${
				this.configLoaderService.data.host
			}</a>
		</nav>
	</body>
</html>`,
			});

			this.logger.info(`Message sent: ${info.messageId}`);
		} catch (err) {
			if (err instanceof Error || typeof err === 'string') {
				this.logger.error(err);
			}
			throw err;
		}
	}

	public async validateEmailForAccount(emailAddress: string): Promise<{
		available: boolean;
		reason: null | 'used' | 'format' | 'disposable' | 'mx' | 'smtp';
	}> {
		const meta = await this.metaService.fetch();

		const exist = await this.prismaService.client.user_profile.count({
			where: {
				emailVerified: true,
				email: emailAddress,
			},
		});

		const validated = meta.enableActiveEmailValidation
			? await validateEmail({
					email: emailAddress,
					validateRegex: true,
					validateMx: true,
					validateTypo: false, // TLDを見ているみたいだけどclubとか弾かれるので
					validateDisposable: true, // 捨てアドかどうかチェック
					validateSMTP: false, // 日本だと25ポートが殆どのプロバイダーで塞がれていてタイムアウトになるので
			  })
			: { valid: true, reason: null };

		const available = exist === 0 && validated.valid;

		return {
			available,
			reason: available
				? null
				: exist !== 0
				? 'used'
				: validated.reason === 'regex'
				? 'format'
				: validated.reason === 'disposable'
				? 'disposable'
				: validated.reason === 'mx'
				? 'mx'
				: validated.reason === 'smtp'
				? 'smtp'
				: null,
		};
	}
}
