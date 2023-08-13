import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { note, user_publickey } from '@prisma/client';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { MemoryKVCache } from '@/misc/cache.js';
import type { UserPublickey } from '@/models/entities/UserPublickey.js';
import { CacheService } from '@/core/CacheService.js';
import type { Note } from '@/models/entities/Note.js';
import { bindThis } from '@/decorators.js';
import { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { PrismaService } from '@/core/PrismaService.js';
import { getApId } from './type.js';
import { ApPersonService } from './models/ApPersonService.js';
import type { IObject } from './type.js';

export type UriParseResult = {
	/** wether the URI was generated by us */
	local: true;
	/** id in DB */
	id: string;
	/** hint of type, e.g. "notes", "users" */
	type: string;
	/** any remaining text after type and id, not including the slash after id. undefined if empty */
	rest?: string;
} | {
	/** wether the URI was generated by us */
	local: false;
	/** uri in DB */
	uri: string;
};

@Injectable()
export class ApDbResolverService implements OnApplicationShutdown {
	private publicKeyCache: MemoryKVCache<user_publickey | null>;
	private publicKeyByUserIdCache: MemoryKVCache<user_publickey | null>;

	constructor(
		@Inject(DI.config)
		private readonly config: Config,

		private readonly cacheService: CacheService,
		private readonly apPersonService: ApPersonService,
		private readonly prismaService: PrismaService,
	) {
		this.publicKeyCache = new MemoryKVCache<user_publickey | null>(Infinity);
		this.publicKeyByUserIdCache = new MemoryKVCache<user_publickey | null>(Infinity);
	}

	@bindThis
	public parseUri(value: string | IObject): UriParseResult {
		const separator = '/';

		const uri = new URL(getApId(value));
		if (uri.origin !== this.config.url) return { local: false, uri: uri.href };

		const [, type, id, ...rest] = uri.pathname.split(separator);
		return {
			local: true,
			type,
			id,
			rest: rest.length === 0 ? undefined : rest.join(separator),
		};
	}

	/**
	 * AP Note => Misskey Note in DB
	 */
	@bindThis
	public async getNoteFromApId(value: string | IObject): Promise<note | null> {
		const parsed = this.parseUri(value);

		if (parsed.local) {
			if (parsed.type !== 'notes') return null;

			return await this.prismaService.client.note.findUnique({
				where: { id: parsed.id },
			});
		} else {
			return await this.prismaService.client.note.findFirst({
				where: { uri: parsed.uri },
			});
		}
	}

	/**
	 * AP Person => Misskey User in DB
	 */
	@bindThis
	public async getUserFromApId(value: string | IObject): Promise<LocalUser | RemoteUser | null> {
		const parsed = this.parseUri(value);

		if (parsed.local) {
			if (parsed.type !== 'users') return null;

			return await this.cacheService.userByIdCache.fetchMaybe(
				parsed.id,
				() => this.prismaService.client.user.findUnique({ where: { id: parsed.id } }).then(x => x ?? undefined),
			) as LocalUser | undefined ?? null;
		} else {
			return await this.cacheService.uriPersonCache.fetch(
				parsed.uri,
				() => this.prismaService.client.user.findFirst({ where: { uri: parsed.uri } }),
			) as RemoteUser | null;
		}
	}

	/**
	 * AP KeyId => Misskey User and Key
	 */
	@bindThis
	public async getAuthUserFromKeyId(keyId: string): Promise<{
		user: RemoteUser;
		key: user_publickey;
	} | null> {
		const key = await this.publicKeyCache.fetch(
			keyId,
			async () => {
				const key = await this.prismaService.client.user_publickey.findUnique({
					where: { keyId },
				});

				if (key == null) return null;

				return key;
			},
			key => key != null,
		);

		if (key == null) return null;

		return {
			user: await this.cacheService.findUserById(key.userId) as RemoteUser,
			key,
		};
	}

	/**
	 * AP Actor id => Misskey User and Key
	 */
	@bindThis
	public async getAuthUserFromApId(uri: string): Promise<{
		user: RemoteUser;
		key: user_publickey | null;
	} | null> {
		const user = await this.apPersonService.resolvePerson(uri) as RemoteUser;

		const key = await this.publicKeyByUserIdCache.fetch(
			user.id,
			() => this.prismaService.client.user_publickey.findUnique({ where: { userId: user.id } }),
			v => v != null,
		);

		return {
			user,
			key,
		};
	}

	@bindThis
	public dispose(): void {
		this.publicKeyCache.dispose();
		this.publicKeyByUserIdCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
