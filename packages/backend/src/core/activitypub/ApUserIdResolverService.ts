import { Injectable } from '@nestjs/common';
import { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApUriParseService } from './ApUriParseService.js';
import type { IObject } from './type.js';

@Injectable()
export class ApUserIdResolverService {
	constructor(
		private readonly apUriParseService: ApUriParseService,
		private readonly userEntityUtilService: UserEntityUtilService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * AP Person => Misskey User in DB
	 */
	public async getUserFromApId(
		value: string | IObject,
	): Promise<LocalUser | RemoteUser | null> {
		const parsed = this.apUriParseService.parse(value);

		if (parsed.local) {
			if (parsed.type !== 'users') return null;

			const result = await this.prismaService.client.user.findUnique({
				where: { id: parsed.id },
			});
			if (result === null) return null;

			if (this.userEntityUtilService.isLocalUser(result)) {
				return result;
			} else {
				throw new Error();
			}
		} else {
			const result = await this.prismaService.client.user.findFirst({
				where: { uri: parsed.uri },
			});

			if (result === null) return null;

			if (this.userEntityUtilService.isRemoteUser(result)) {
				return result;
			} else {
				throw new Error();
			}
		}
	}
}
