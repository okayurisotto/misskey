import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { getIpHash } from '@/misc/get-ip-hash.js';
import type { LocalUser } from '@/models/entities/User.js';
import { IdService } from '@/core/IdService.js';
import { TwoFactorAuthenticationService } from '@/core/TwoFactorAuthenticationService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RateLimiterService } from './RateLimiterService.js';
import { SigninService } from './SigninService.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

type SignInResult =
  | { error: { id: string } }
  | { id: string; i: string | null }
  | {
      challenge?: undefined;
      challengeId?: undefined;
      error: { message: string; code: string; id: string };
      securityKeys?: undefined;
    }
  | {
      challenge: string;
      challengeId: string;
      error?: undefined;
      securityKeys: { id: string }[];
    }
  | undefined;

@Injectable()
export class SigninApiService {
	constructor(
		@Inject(DI.config)
		private readonly config: Config,

		private readonly idService: IdService,
		private readonly rateLimiterService: RateLimiterService,
		private readonly signinService: SigninService,
		private readonly twoFactorAuthenticationService: TwoFactorAuthenticationService,
		private readonly prismaService: PrismaService,
	) {
	}

	@bindThis
	public async signin(
		request: FastifyRequest<{
			Body: {
				username: string;
				password: string;
				token?: string;
				signature?: string;
				authenticatorData?: string;
				clientDataJSON?: string;
				credentialId?: string;
				challengeId?: string;
			};
		}>,
		reply: FastifyReply,
	): Promise<SignInResult> {
		reply.header('Access-Control-Allow-Origin', this.config.url);
		reply.header('Access-Control-Allow-Credentials', 'true');

		const body = request.body;
		const username = body['username'];
		const password = body['password'];
		const token = body['token'];

		function error<T extends { id: string }>(status: number, error: T): { error: T } {
			reply.code(status);
			return { error };
		}

		try {
		// not more than 1 attempt per second and not more than 10 attempts per hour
			await this.rateLimiterService.limit({ key: 'signin', duration: 60 * 60 * 1000, max: 10, minInterval: 1000 }, getIpHash(request.ip));
		} catch (err) {
			reply.code(429);
			return {
				error: {
					message: 'Too many failed attempts to sign in. Try again later.',
					code: 'TOO_MANY_AUTHENTICATION_FAILURES',
					id: '22d05606-fbcf-421a-a2db-b32610dcfd1b',
				},
			};
		}

		if (typeof username !== 'string') {
			reply.code(400);
			return;
		}

		if (typeof password !== 'string') {
			reply.code(400);
			return;
		}

		if (token != null && typeof token !== 'string') {
			reply.code(400);
			return;
		}

		// Fetch user
		const user = await this.prismaService.client.user.findFirst({
			where: {
				usernameLower: username.toLowerCase(),
				host: null,
			},
		}) as LocalUser;

		if (user == null) {
			return error(404, {
				id: '6cc579cc-885d-43d8-95c2-b8c7fc963280',
			});
		}

		if (user.isSuspended) {
			return error(403, {
				id: 'e03a5f46-d309-4865-9b69-56282d94e1eb',
			});
		}

		const profile = await this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: user.id } });

		// Compare password
		const same = await bcrypt.compare(password, profile.password!);

		const fail = async (status?: number, failure?: { id: string }): Promise<{ error: { id: string } }> => {
		// Append signin history
			await this.prismaService.client.signin.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: user.id,
					ip: request.ip,
					headers: request.headers as any,
					success: false,
				},
			});

			return error(status ?? 500, failure ?? { id: '4e30e80c-e338-45a0-8c8f-44455efa3b76' });
		};

		if (!profile.twoFactorEnabled) {
			if (same) {
				return this.signinService.signin(request, reply, user);
			} else {
				return await fail(403, {
					id: '932c904e-9460-45b7-9ce6-7ed33be7eb2c',
				});
			}
		}

		if (token) {
			if (!same) {
				return await fail(403, {
					id: '932c904e-9460-45b7-9ce6-7ed33be7eb2c',
				});
			}

			const delta = OTPAuth.TOTP.validate({
				secret: OTPAuth.Secret.fromBase32(profile.twoFactorSecret!),
				digits: 6,
				token,
				window: 1,
			});

			if (delta === null) {
				return await fail(403, {
					id: 'cdf1235b-ac71-46d4-a3a6-84ccce48df6f',
				});
			} else {
				return this.signinService.signin(request, reply, user);
			}
		} else if (body.credentialId && body.clientDataJSON && body.authenticatorData && body.signature) {
			if (!same && !profile.usePasswordLessLogin) {
				return await fail(403, {
					id: '932c904e-9460-45b7-9ce6-7ed33be7eb2c',
				});
			}

			const clientDataJSON = Buffer.from(body.clientDataJSON, 'hex');
			const clientData = JSON.parse(clientDataJSON.toString('utf-8'));
			const challenge = await this.prismaService.client.attestation_challenge.findFirst({
				where: {
					userId: user.id,
					id: body.challengeId,
					registrationChallenge: false,
					challenge: this.twoFactorAuthenticationService.hash(clientData.challenge).toString('hex'),
				},
			});

			if (!challenge) {
				return await fail(403, {
					id: '2715a88a-2125-4013-932f-aa6fe72792da',
				});
			}

			await this.prismaService.client.attestation_challenge.deleteMany({
				where: {
					userId: user.id,
					id: body.challengeId,
				},
			});

			if (new Date().getTime() - challenge.createdAt.getTime() >= 5 * 60 * 1000) {
				return await fail(403, {
					id: '2715a88a-2125-4013-932f-aa6fe72792da',
				});
			}

			const securityKey = await this.prismaService.client.user_security_key.findUnique({
				where: {
					id: Buffer.from(
						body.credentialId
						.replace(/-/g, '+')
						.replace(/_/g, '/'),
						'base64',
						).toString('hex'),
				},
			});

			if (!securityKey) {
				return await fail(403, {
					id: '66269679-aeaf-4474-862b-eb761197e046',
				});
			}

			const isValid = this.twoFactorAuthenticationService.verifySignin({
				publicKey: Buffer.from(securityKey.publicKey, 'hex'),
				authenticatorData: Buffer.from(body.authenticatorData, 'hex'),
				clientDataJSON,
				clientData,
				signature: Buffer.from(body.signature, 'hex'),
				challenge: challenge.challenge,
			});

			if (isValid) {
				return this.signinService.signin(request, reply, user);
			} else {
				return await fail(403, {
					id: '93b86c4b-72f9-40eb-9815-798928603d1e',
				});
			}
		} else {
			if (!same && !profile.usePasswordLessLogin) {
				return await fail(403, {
					id: '932c904e-9460-45b7-9ce6-7ed33be7eb2c',
				});
			}

			const keys = await this.prismaService.client.user_security_key.findMany({
				where: {
					userId: user.id,
				},
			});

			if (keys.length === 0) {
				return await fail(403, {
					id: 'f27fd449-9af4-4841-9249-1f989b9fa4a4',
				});
			}

			// 32 byte challenge
			const challenge = randomBytes(32).toString('base64')
				.replace(/=/g, '')
				.replace(/\+/g, '-')
				.replace(/\//g, '_');

			const challengeId = this.idService.genId();

			await this.prismaService.client.attestation_challenge.create({
				data: {
					userId: user.id,
					id: challengeId,
					challenge: this.twoFactorAuthenticationService.hash(Buffer.from(challenge, 'utf-8')).toString('hex'),
					createdAt: new Date(),
					registrationChallenge: false,
				},
			});

			reply.code(200);
			return {
				challenge,
				challengeId,
				securityKeys: keys.map(key => ({
					id: key.id,
				})),
			};
		}
	// never get here
	}
}
