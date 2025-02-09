import { promisify } from 'node:util';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import cbor from 'cbor';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { TwoFactorAuthenticationService } from '@/core/TwoFactorAuthenticationService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

const cborDecodeFirst = promisify(cbor.decodeFirst) as any;

const res = z.object({
	id: z.string(),
	name: z.string(),
});
export const meta = {
	requireCredential: true,
	secure: true,
	res,
} as const;

export const paramDef = z.object({
	clientDataJSON: z.string(),
	attestationObject: z.string(),
	password: z.string(),
	challengeId: z.string(),
	name: z.string().min(1).max(30),
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

		private readonly userEntityService: UserEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly twoFactorAuthenticationService: TwoFactorAuthenticationService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const rpIdHashReal = this.twoFactorAuthenticationService.hash(
				Buffer.from(this.configLoaderService.data.hostname, 'utf-8'),
			);

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

			const clientData = JSON.parse(ps.clientDataJSON);

			if (clientData.type !== 'webauthn.create') {
				throw new Error('not a creation attestation');
			}
			if (
				clientData.origin !==
				this.configLoaderService.data.scheme +
					'://' +
					this.configLoaderService.data.host
			) {
				throw new Error('origin mismatch');
			}

			const clientDataJSONHash = this.twoFactorAuthenticationService.hash(
				Buffer.from(ps.clientDataJSON, 'utf-8'),
			);

			const attestation = await cborDecodeFirst(ps.attestationObject);

			const rpIdHash = attestation.authData.slice(0, 32);
			if (!rpIdHashReal.equals(rpIdHash)) {
				throw new Error('rpIdHash mismatch');
			}

			const flags = attestation.authData[32];

			// eslint:disable-next-line:no-bitwise
			if (!(flags & 1)) {
				throw new Error('user not present');
			}

			const authData = Buffer.from(attestation.authData);
			const credentialIdLength = authData.readUInt16BE(53);
			const credentialId = authData.slice(55, 55 + credentialIdLength);
			const publicKeyData = authData.slice(55 + credentialIdLength);
			const publicKey: Map<number, any> = await cborDecodeFirst(publicKeyData);
			if (publicKey.get(3) !== -7) {
				throw new Error('alg mismatch');
			}

			const procedures = this.twoFactorAuthenticationService.getProcedures();

			if (!(procedures as any)[attestation.fmt]) {
				throw new Error(
					`unsupported fmt: ${attestation.fmt}. Supported ones: ${Object.keys(
						procedures,
					)}`,
				);
			}

			const verificationData = (procedures as any)[attestation.fmt].verify({
				attStmt: attestation.attStmt,
				authenticatorData: authData,
				clientDataHash: clientDataJSONHash,
				credentialId,
				publicKey,
				rpIdHash,
			});
			if (!verificationData.valid) throw new Error('signature invalid');

			const attestationChallenge =
				await this.prismaService.client.attestationChallenge.findUnique({
					where: {
						id_userId: {
							userId: me.id,
							id: ps.challengeId,
						},
						registrationChallenge: true,
						challenge: this.twoFactorAuthenticationService
							.hash(clientData.challenge)
							.toString('hex'),
					},
				});

			if (!attestationChallenge) {
				throw new Error('non-existent challenge');
			}

			await this.prismaService.client.attestationChallenge.delete({
				where: {
					id_userId: {
						userId: me.id,
						id: ps.challengeId,
					},
				},
			});

			// Expired challenge (> 5min old)
			if (
				new Date().getTime() - attestationChallenge.createdAt.getTime() >=
				5 * 60 * 1000
			) {
				throw new Error('expired challenge');
			}

			const credentialIdString = credentialId.toString('hex');

			await this.prismaService.client.user_security_key.create({
				data: {
					userId: me.id,
					id: credentialIdString,
					lastUsed: new Date(),
					name: ps.name,
					publicKey: verificationData.publicKey.toString('hex'),
				},
			});

			// Publish meUpdated event
			this.globalEventService.publishMainStream(
				me.id,
				'meUpdated',
				await this.userEntityService.packDetailedMe(me.id, {
					includeSecrets: true,
				}),
			);

			return {
				id: credentialIdString,
				name: ps.name,
			};
		});
	}
}
