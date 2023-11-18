import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { CacheService } from '@/core/CacheService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

@Injectable()
export class ApPersonFetchService {
	constructor(
		private readonly cacheService: CacheService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * uriからUser(Person)をフェッチします。
	 *
	 * Misskeyに対象のPersonが登録されていればそれを返し、登録がなければnullを返します。
	 */
	public async fetch(uri: string): Promise<LocalUser | RemoteUser | null> {
		const cached = this.cacheService.uriPersonCache.get(uri) as
			| LocalUser
			| RemoteUser
			| null
			| undefined;
		if (cached) return cached;

		// URIがこのサーバーを指しているならデータベースからフェッチ
		if (uri.startsWith(`${this.configLoaderService.data.url}/`)) {
			const id = uri.split('/').pop();
			const u = (await this.prismaService.client.user.findUnique({
				where: { id },
			})) as LocalUser | null;
			if (u) this.cacheService.uriPersonCache.set(uri, u);
			return u;
		}

		//#region このサーバーに既に登録されていたらそれを返す
		const exist = (await this.prismaService.client.user.findFirst({
			where: { uri },
		})) as LocalUser | RemoteUser | null;

		if (exist) {
			this.cacheService.uriPersonCache.set(uri, exist);
			return exist;
		}
		//#endregion

		return null;
	}
}
