import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { genRsaKeyPair } from '@/misc/gen-key-pair.js';
import { IdService } from '@/core/IdService.js';
import generateNativeUserToken from '@/misc/generate-native-user-token.js';
import { PrismaService } from './PrismaService.js';
import type { user } from '@prisma/client';

@Injectable()
export class CreateSystemUserService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async createSystemUser(username: string): Promise<user> {
		const password = randomUUID();
		const salt = await bcrypt.genSalt(8);
		const hash = await bcrypt.hash(password, salt);

		const secret = generateNativeUserToken();
		const keyPair = await genRsaKeyPair();

		return await this.prismaService.client.$transaction(async (client) => {
			const exist = await client.user.findFirst({
				where: {
					usernameLower: username.toLowerCase(),
					host: null,
				},
			});
			if (exist) throw new Error('the user is already exists');

			const account = await client.user.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					username: username,
					usernameLower: username.toLowerCase(),
					host: null,
					token: secret,
					isRoot: false,
					isLocked: true,
					isExplorable: false,
					isBot: true,

					user_keypair: {
						create: {
							publicKey: keyPair.publicKey,
							privateKey: keyPair.privateKey,
						},
					},

					user_profile: {
						create: {
							autoAcceptFollowed: false,
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
		});
	}
}
