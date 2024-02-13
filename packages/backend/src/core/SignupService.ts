import { generateKeyPair } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { IdService } from '@/core/IdService.js';
import generateUserToken from '@/misc/generate-native-user-token.js';
import UsersChart from '@/core/chart/charts/users.js';
import { UtilityService } from '@/core/UtilityService.js';
import { MetaService } from '@/core/MetaService.js';
import { LocalUsernameSchema, PasswordSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { User, user_profile } from '@prisma/client';

@Injectable()
export class SignupService {
	constructor(
		private readonly idService: IdService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
		private readonly usersChart: UsersChart,
		private readonly utilityService: UtilityService,
	) {}

	public async signup(opts: {
		username: User['username'];
		password?: string | null;
		passwordHash?: user_profile['password'] | null;
		host?: string | null;
		ignorePreservedUsernames?: boolean;
	}): Promise<{ account: User; secret: string }> {
		const { username, password, passwordHash, host } = opts;
		let hash = passwordHash;

		// Validate username
		if (!LocalUsernameSchema.safeParse(username).success) {
			throw new Error('INVALID_USERNAME');
		}

		if (password != null && passwordHash == null) {
			// Validate password
			if (!PasswordSchema.safeParse(password).success) {
				throw new Error('INVALID_PASSWORD');
			}

			// Generate hash of password
			const salt = await bcrypt.genSalt(8);
			hash = await bcrypt.hash(password, salt);
		}

		// Generate secret
		const secret = generateUserToken();

		// Check username duplication
		if (
			(await this.prismaService.client.user.count({
				where: { usernameLower: username.toLowerCase(), host: null },
				take: 1,
			})) > 0
		) {
			throw new Error('DUPLICATED_USERNAME');
		}

		// Check deleted username duplication
		if (
			(await this.prismaService.client.usedUsername.count({
				where: { username: username.toLowerCase() },
				take: 1,
			})) > 0
		) {
			throw new Error('USED_USERNAME');
		}

		const isTheFirstUser =
			(await this.prismaService.client.user.count({
				where: { host: null },
			})) === 0;

		if (!opts.ignorePreservedUsernames && !isTheFirstUser) {
			const instance = await this.metaService.fetch();
			const isPreserved = instance.preservedUsernames
				.map((x) => x.toLowerCase())
				.includes(username.toLowerCase());
			if (isPreserved) {
				throw new Error('USED_USERNAME');
			}
		}

		const keyPair = await new Promise<string[]>((res, rej) =>
			generateKeyPair(
				'rsa',
				{
					modulusLength: 2048,
					publicKeyEncoding: {
						type: 'spki',
						format: 'pem',
					},
					privateKeyEncoding: {
						type: 'pkcs8',
						format: 'pem',
						cipher: undefined,
						passphrase: undefined,
					},
				},
				(err, publicKey, privateKey) =>
					err ? rej(err) : res([publicKey, privateKey]),
			),
		);

		const account = await this.prismaService.client.$transaction(
			async (client) => {
				const exist = await client.user.findFirst({
					where: {
						usernameLower: username.toLowerCase(),
						host: null,
					},
				});

				if (exist) throw new Error('the username is already used');

				const account = await client.user.create({
					data: {
						id: this.idService.genId(),
						createdAt: new Date(),
						username: username,
						usernameLower: username.toLowerCase(),
						host: this.utilityService.toPunyNullable(host),
						token: secret,
						isRoot: isTheFirstUser,

						userKeypair: {
							create: {
								publicKey: keyPair[0],
								privateKey: keyPair[1],
							},
						},

						userProfile: {
							create: {
								autoAcceptFollowed: true,
								password: hash,
							},
						},
					},
				});

				await client.usedUsername.create({
					data: {
						createdAt: new Date(),
						username: username.toLowerCase(),
					},
				});

				return account;
			},
		);

		this.usersChart.update(account, true);

		return { account, secret };
	}
}
