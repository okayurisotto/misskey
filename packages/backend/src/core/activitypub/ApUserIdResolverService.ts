import { Injectable } from '@nestjs/common';
import { CacheService } from '@/core/CacheService.js';
import { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApUriParseService } from './ApUriParseService.js';
import type { IObject } from './type.js';

@Injectable()
export class ApUserIdResolverService {
	constructor(
		private readonly apUriParseService: ApUriParseService,
		private readonly cacheService: CacheService,
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

			return (
				((await this.cacheService.userByIdCache.fetchMaybe(parsed.id, () =>
					this.prismaService.client.user
						.findUnique({ where: { id: parsed.id } })
						.then((x) => x ?? undefined),
				)) as LocalUser | undefined) ?? null
			);
		} else {
			return (await this.cacheService.uriPersonCache.fetch(parsed.uri, () =>
				this.prismaService.client.user.findFirst({
					where: { uri: parsed.uri },
				}),
			)) as RemoteUser | null;
		}
	}
}
