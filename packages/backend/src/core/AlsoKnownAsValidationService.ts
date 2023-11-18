import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { ApPersonFetchService } from './activitypub/models/ApPersonFetchService.js';
import { ApPersonUpdateService } from './activitypub/models/ApPersonUpdateService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';

@Injectable()
export class AlsoKnownAsValidationService {
	constructor(
		private readonly apPersonFetchService: ApPersonFetchService,
		private readonly apPersonUpdateService: ApPersonUpdateService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * dstユーザーのalsoKnownAsをfetchPersonしていき、本当にmovedToUrlをdstに指定するユーザーが存在するのかを調べる
	 *
	 * @param dst movedToUrlを指定するユーザー
	 * @param check
	 * @param instant checkがtrueであるユーザーが最初に見つかったら即座にreturnするかどうか
	 * @returns {Promise<LocalUser | RemoteUser | null>}
	 */
	public async validate(
		dst_: LocalUser | RemoteUser,
		check: (
			oldUser: LocalUser | RemoteUser | null,
			newUser: LocalUser | RemoteUser,
		) => boolean | Promise<boolean> = (): boolean => true,
		instant = false,
	): Promise<LocalUser | RemoteUser | null> {
		let resultUser: LocalUser | RemoteUser | null = null;

		const dst = await (async (): Promise<LocalUser | RemoteUser> => {
			if (this.userEntityUtilService.isLocalUser(dst_)) {
				return dst_;
			} else {
				if (
					new Date().getTime() - (dst_.lastFetchedAt?.getTime() ?? 0) >
					10 * 1000
				) {
					await this.apPersonUpdateService.update(dst_.uri);
				}
				return (await this.apPersonFetchService.fetch(dst_.uri)) ?? dst_;
			}
		})();

		if (!dst.alsoKnownAs) return null;
		if (dst.alsoKnownAs.split(',').length === 0) return null;

		const dstUri = this.userEntityUtilService.getUserUri(dst);

		for (const srcUri of dst.alsoKnownAs.split(',')) {
			try {
				let src = await this.apPersonFetchService.fetch(srcUri);
				if (!src) continue; // oldAccountを探してもこのサーバーに存在しない場合はフォロー関係もないということなのでスルー

				if (this.userEntityUtilService.isRemoteUser(dst)) {
					if (
						new Date().getTime() - (src.lastFetchedAt?.getTime() ?? 0) >
						10 * 1000
					) {
						await this.apPersonUpdateService.update(srcUri);
					}

					src = (await this.apPersonFetchService.fetch(srcUri)) ?? src;
				}

				if (src.movedToUri === dstUri) {
					if (await check(resultUser, src)) {
						resultUser = src;
					}
					if (instant && resultUser) return resultUser;
				}
			} catch {
				/* skip if any error happens */
			}
		}

		return resultUser;
	}
}
