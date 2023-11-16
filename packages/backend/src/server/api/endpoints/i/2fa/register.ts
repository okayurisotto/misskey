import { z } from 'zod';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

const res = z.object({
	qr: z.string(),
	url: z.string(),
	secret: z.string(),
	label: z.string(),
	issuer: z.string(),
});
export const meta = {
	requireCredential: true,
	secure: true,
	res,
} as const;

export const paramDef = z.object({
	password: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,

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
				throw new Error('incorrect password');
			}

			// Generate user's secret key
			const secret = new OTPAuth.Secret();

			await this.prismaService.client.user_profile.update({
				where: { userId: me.id },
				data: { twoFactorTempSecret: secret.base32 },
			});

			// Get the data URL of the authenticator URL
			const totp = new OTPAuth.TOTP({
				secret,
				digits: 6,
				label: me.username,
				issuer: this.configLoaderService.data.host,
			});
			const url = totp.toString();
			const qr = await QRCode.toDataURL(url);

			return {
				qr,
				url,
				secret: secret.base32,
				label: me.username,
				issuer: this.configLoaderService.data.host,
			};
		});
	}
}
