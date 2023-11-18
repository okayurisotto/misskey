import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { AccountMovingPostProcessService } from '@/core/AccountMovingPostProcessService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import { ApPersonFetchService } from './ApPersonFetchService.js';
import { ApPersonResolveService } from './ApPersonResolveService.js';

@Injectable()
export class RemoteAccountMovingService {
	constructor(
		private readonly accountMovingPostProcessService: AccountMovingPostProcessService,
		private readonly apPersonFetchService: ApPersonFetchService,
		private readonly apPersonResolveService: ApPersonResolveService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * リモート由来のアカウント移行処理を行います
	 * @param src 移行元アカウント（リモートかつupdatePerson後である必要がある、というかこれ自体がupdatePersonで呼ばれる前提）
	 * @param movePreventUris ここに列挙されたURIにsrc.movedToUriが含まれる場合、移行処理はしない（無限ループ防止）
	 */
	public async move(
		src: RemoteUser,
		movePreventUris: string[] = [],
	): Promise<string> {
		if (!src.movedToUri) return 'skip: no movedToUri';
		if (src.uri === src.movedToUri) return 'skip: movedTo itself (src)'; // ？？？
		if (movePreventUris.length > 10) return 'skip: too many moves';

		// まずサーバー内で検索して様子見
		let dst = await this.apPersonFetchService.fetch(src.movedToUri);

		if (dst && this.userEntityUtilService.isLocalUser(dst)) {
			// targetがローカルユーザーだった場合データベースから引っ張ってくる
			dst = (await this.prismaService.client.user.findFirstOrThrow({
				where: { uri: src.movedToUri },
			})) as LocalUser;
		} else if (dst) {
			if (movePreventUris.includes(src.movedToUri))
				return 'skip: circular move';

			// targetを見つけたことがあるならtargetをupdatePersonする
			await this.updatePerson(src.movedToUri, undefined, undefined, [
				...movePreventUris,
				src.uri,
			]);
			dst = (await this.apPersonFetchService.fetch(src.movedToUri)) ?? dst;
		} else {
			if (src.movedToUri.startsWith(`${this.configLoaderService.data.url}/`)) {
				// ローカルユーザーっぽいのにfetchPersonで見つからないということはmovedToUriが間違っている
				return 'failed: movedTo is local but not found';
			}

			// targetが知らない人だったらresolvePerson
			// (uriが存在しなかったり応答がなかったりする場合resolvePersonはthrow Errorする)
			dst = await this.apPersonResolveService.resolve(src.movedToUri);
		}

		if (dst.movedToUri === dst.uri) return 'skip: movedTo itself (dst)'; // ？？？
		if (src.movedToUri !== dst.uri) return 'skip: missmatch uri'; // ？？？
		if (dst.movedToUri === src.uri) return 'skip: dst.movedToUri === src.uri';
		if (!dst.alsoKnownAs || dst.alsoKnownAs.split(',').length === 0) {
			return 'skip: dst.alsoKnownAs is empty';
		}
		if (!dst.alsoKnownAs.split(',').includes(src.uri)) {
			return 'skip: alsoKnownAs does not include from.uri';
		}

		await this.accountMovingPostProcessService.process(src, dst);

		return 'ok';
	}
}
