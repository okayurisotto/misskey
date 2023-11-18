import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { ApResolverService, type Resolver } from '../ApResolverService.js';
import { ApPersonFetchService } from './ApPersonFetchService.js';
import { ApPersonCreateService } from './ApPersonCreateService.js';

@Injectable()
export class ApPersonResolveService {
	constructor(
		private readonly apPersonCreateService: ApPersonCreateService,
		private readonly apPersonFetchService: ApPersonFetchService,
		private readonly apResolverService: ApResolverService,
	) {}

	/**
	 * Personを解決します。
	 *
	 * Misskeyに対象のPersonが登録されていればそれを返し、そうでなければ
	 * リモートサーバーからフェッチしてMisskeyに登録しそれを返します。
	 */
	public async resolve(
		uri: string,
		resolver?: Resolver,
	): Promise<LocalUser | RemoteUser> {
		// このサーバーに既に登録されていたらそれを返す
		const exist = await this.apPersonFetchService.fetch(uri);
		if (exist) return exist;

		// リモートサーバーからフェッチしてきて登録
		if (resolver == null) resolver = this.apResolverService.createResolver();
		return await this.apPersonCreateService.create(uri, resolver);
	}
}
