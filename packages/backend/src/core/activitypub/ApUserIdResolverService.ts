import { Injectable } from '@nestjs/common';
import { CacheService } from '@/core/CacheService.js';
import { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import { ApUriParseService } from './ApUriParseService.js';
import type { IObject } from './type.js';

@Injectable()
export class ApUserIdResolverService {
	constructor(
		private readonly apUriParseService: ApUriParseService,
		private readonly cacheService: CacheService,
		private readonly userEntityUtilService: UserEntityUtilService,
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

			const result = await this.cacheService.userByIdCache.fetch(parsed.id);
			if (result === null) return null;

			if (this.userEntityUtilService.isLocalUser(result)) {
				return result;
			} else {
				throw new Error();
			}
		} else {
			const result = await this.cacheService.uriPersonCache.fetch(parsed.uri);
			if (result === null) return null;

			if (this.userEntityUtilService.isRemoteUser(result)) {
				return result;
			} else {
				throw new Error();
			}
		}
	}
}
