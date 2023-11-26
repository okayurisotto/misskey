import { promisify } from 'node:util';
import * as crypto from 'node:crypto';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { TwoFactorAuthenticationService } from '@/core/TwoFactorAuthenticationService.js';
import { PrismaService } from '@/core/PrismaService.js';

const randomBytes = promisify(crypto.randomBytes);

const res = z.object({
	challengeId: z.string(),
	challenge: z.string(),
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
		private readonly idService: IdService,
		private readonly twoFactorAuthenticationService: TwoFactorAuthenticationService,
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

			if (!profile.twoFactorEnabled) {
				throw new Error('2fa not enabled');
			}

			// 32 byte challenge
			const entropy = await randomBytes(32);
			const challenge = entropy
				.toString('base64')
				.replace(/=/g, '')
				.replace(/\+/g, '-')
				.replace(/\//g, '_');

			const challengeId = this.idService.genId();

			await this.prismaService.client.attestationChallenge.create({
				data: {
					userId: me.id,
					id: challengeId,
					challenge: this.twoFactorAuthenticationService
						.hash(Buffer.from(challenge, 'utf-8'))
						.toString('hex'),
					createdAt: new Date(),
					registrationChallenge: true,
				},
			});

			return {
				challengeId,
				challenge,
			};
		});
	}
}
