import { promisify } from 'node:util';
import * as crypto from 'node:crypto';
import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import bcrypt from 'bcryptjs';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	UserProfilesRepository,
	AttestationChallengesRepository,
} from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { TwoFactorAuthenticationService } from '@/core/TwoFactorAuthenticationService.js';
import { DI } from '@/di-symbols.js';

const randomBytes = promisify(crypto.randomBytes);

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	password: z.string(),
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
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.attestationChallengesRepository)
		private attestationChallengesRepository: AttestationChallengesRepository,

		private idService: IdService,
		private twoFactorAuthenticationService: TwoFactorAuthenticationService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({
				userId: me.id,
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

			await this.attestationChallengesRepository.insert({
				userId: me.id,
				id: challengeId,
				challenge: this.twoFactorAuthenticationService
					.hash(Buffer.from(challenge, 'utf-8'))
					.toString('hex'),
				createdAt: new Date(),
				registrationChallenge: true,
			});

			return {
				challengeId,
				challenge,
			} satisfies z.infer<typeof res>;
		});
	}
}
