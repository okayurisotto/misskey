import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { bindThis } from '@/decorators.js';
import { MemoryKVCache, RedisSingleCache } from '@/misc/cache.js';
import { UtilityService } from '@/core/UtilityService.js';
import type { Serialized } from '@/server/api/stream/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { Prisma, role, drive_file, emoji } from '@prisma/client';

const parseEmojiStrRegexp = /^(\w+)(?:@([\w.-]+))?$/;

@Injectable()
export class CustomEmojiService implements OnApplicationShutdown {
	private cache: MemoryKVCache<emoji | null>;
	public localEmojisCache: RedisSingleCache<Map<string, emoji>>;

	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private readonly utilityService: UtilityService,
		private readonly idService: IdService,
		private readonly emojiEntityService: EmojiEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		this.cache = new MemoryKVCache<emoji | null>(1000 * 60 * 60 * 12);

		this.localEmojisCache = new RedisSingleCache<Map<string, emoji>>(this.redisClient, 'localEmojis', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60 * 3, // 3m
			fetcher: () => this.prismaService.client.emoji.findMany({ where: { host: null } }).then(emojis => new Map(emojis.map(emoji => [emoji.name, emoji]))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value.values())),
			fromRedisConverter: (value) => {
				if (!Array.isArray(JSON.parse(value))) return undefined; // 古いバージョンの壊れたキャッシュが残っていることがある(そのうち消す)
				return new Map(JSON.parse(value).map((x: Serialized<emoji>) => [x.name, {
					...x,
					updatedAt: x.updatedAt ? new Date(x.updatedAt) : null,
				}]));
			},
		});
	}

	@bindThis
	public async add(data: {
		driveFile: drive_file;
		name: string;
		category: string | null;
		aliases: string[];
		host: string | null;
		license: string | null;
		isSensitive: boolean;
		localOnly: boolean;
		roleIdsThatCanBeUsedThisEmojiAsReaction: role['id'][];
	}): Promise<emoji> {
		const emoji = await this.prismaService.client.emoji.create({
			data: {
				id: this.idService.genId(),
				updatedAt: new Date(),
				name: data.name,
				category: data.category,
				host: data.host,
				aliases: data.aliases,
				originalUrl: data.driveFile.url,
				publicUrl: data.driveFile.webpublicUrl ?? data.driveFile.url,
				type: data.driveFile.webpublicType ?? data.driveFile.type,
				license: data.license,
				isSensitive: data.isSensitive,
				localOnly: data.localOnly,
				roleIdsThatCanBeUsedThisEmojiAsReaction: data.roleIdsThatCanBeUsedThisEmojiAsReaction,
			},
		});

		if (data.host == null) {
			this.localEmojisCache.refresh();

			this.globalEventService.publishBroadcastStream('emojiAdded', {
				emoji: await this.emojiEntityService.packDetailed(emoji.id),
			});
		}

		return emoji;
	}

	@bindThis
	public async update(id: emoji['id'], data: {
		driveFile?: drive_file;
		name?: string;
		category?: string | null;
		aliases?: string[];
		license?: string | null;
		isSensitive?: boolean;
		localOnly?: boolean;
		roleIdsThatCanBeUsedThisEmojiAsReaction?: role['id'][];
	}): Promise<void> {
		const emoji = await this.prismaService.client.emoji.findUniqueOrThrow({ where: { id: id } });
		const sameNameEmoji = await this.prismaService.client.emoji.findFirst({ where: { name: data.name, host: null } });
		if (sameNameEmoji != null && sameNameEmoji.id !== id) throw new Error('name already exists');

		await this.prismaService.client.emoji.update({
			where: { id: emoji.id },
			data: {
				updatedAt: new Date(),
				name: data.name,
				category: data.category,
				aliases: data.aliases,
				license: data.license,
				isSensitive: data.isSensitive,
				localOnly: data.localOnly,
				originalUrl: data.driveFile != null ? data.driveFile.url : undefined,
				publicUrl: data.driveFile != null ? (data.driveFile.webpublicUrl ?? data.driveFile.url) : undefined,
				type: data.driveFile != null ? (data.driveFile.webpublicType ?? data.driveFile.type) : undefined,
				roleIdsThatCanBeUsedThisEmojiAsReaction: data.roleIdsThatCanBeUsedThisEmojiAsReaction ?? undefined,
			},
		});

		this.localEmojisCache.refresh();

		const updated = await this.emojiEntityService.packDetailed(emoji.id);

		if (emoji.name === data.name) {
			this.globalEventService.publishBroadcastStream('emojiUpdated', {
				emojis: [updated],
			});
		} else {
			this.globalEventService.publishBroadcastStream('emojiDeleted', {
				emojis: [await this.emojiEntityService.packDetailed(emoji)],
			});

			this.globalEventService.publishBroadcastStream('emojiAdded', {
				emoji: updated,
			});
		}
	}

	@bindThis
	public async addAliasesBulk(ids: emoji['id'][], aliases: string[]) {
		const emojis = await this.prismaService.client.emoji.findMany({ where: { id: { in: ids } } });

		for (const emoji of emojis) {
			await this.prismaService.client.emoji.update({
				where: { id: emoji.id },
				data: {
					updatedAt: new Date(),
					aliases: [...new Set(emoji.aliases.concat(aliases))],
				},
			});
		}

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await Promise.all(ids.map((id) => this.emojiEntityService.packDetailed(id))),
		});
	}

	@bindThis
	public async setAliasesBulk(ids: emoji['id'][], aliases: string[]) {
		await this.prismaService.client.emoji.updateMany({
			where: { id: { in: ids } },
			data: {
				updatedAt: new Date(),
				aliases: aliases,
			},
		});

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await Promise.all(ids.map((id) => this.emojiEntityService.packDetailed(id))),
		});
	}

	@bindThis
	public async removeAliasesBulk(ids: emoji['id'][], aliases: string[]) {
		const emojis = await this.prismaService.client.emoji.findMany({ where: { id: { in: ids } } });

		for (const emoji of emojis) {
			await this.prismaService.client.emoji.update({
				where: { id: emoji.id },
				data: {
					updatedAt: new Date(),
					aliases: emoji.aliases.filter(x => !aliases.includes(x)),
				},
			});
		}

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await Promise.all(ids.map((id) => this.emojiEntityService.packDetailed(id))),
		});
	}

	@bindThis
	public async setCategoryBulk(ids: emoji['id'][], category: string | null) {
		await this.prismaService.client.emoji.updateMany({
			where: { id: { in: ids } },
			data: {
				updatedAt: new Date(),
				category: category,
			},
		});

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await Promise.all(ids.map((id) => this.emojiEntityService.packDetailed(id))),
		});
	}

	@bindThis
	public async setLicenseBulk(ids: emoji['id'][], license: string | null) {
		await this.prismaService.client.emoji.updateMany({
			where: { id: { in: ids } },
			data: {
				updatedAt: new Date(),
				license: license,
			},
		});

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await Promise.all(ids.map((id) => this.emojiEntityService.packDetailed(id))),
		});
	}

	@bindThis
	public async delete(id: emoji['id']) {
		const emoji = await this.prismaService.client.emoji.findUniqueOrThrow({ where: { id: id } });

		await this.prismaService.client.emoji.delete({ where: { id: emoji.id } });

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiDeleted', {
			emojis: [await this.emojiEntityService.packDetailed(emoji)],
		});
	}

	@bindThis
	public async deleteBulk(ids: emoji['id'][]) {
		const emojis = await this.prismaService.client.emoji.findMany({ where: { id: { in: ids } } });

		for (const emoji of emojis) {
			await this.prismaService.client.emoji.delete({ where: { id: emoji.id } });
		}

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiDeleted', {
			emojis: await Promise.all(emojis.map((emoji) => this.emojiEntityService.packDetailed(emoji))),
		});
	}

	@bindThis
	private normalizeHost(src: string | undefined, noteUserHost: string | null): string | null {
	// クエリに使うホスト
		let host = src === '.' ? null	// .はローカルホスト (ここがマッチするのはリアクションのみ)
			: src === undefined ? noteUserHost	// ノートなどでホスト省略表記の場合はローカルホスト (ここがリアクションにマッチすることはない)
			: this.utilityService.isSelfHost(src) ? null	// 自ホスト指定
			: (src || noteUserHost);	// 指定されたホスト || ノートなどの所有者のホスト (こっちがリアクションにマッチすることはない)

		host = this.utilityService.toPunyNullable(host);

		return host;
	}

	@bindThis
	public parseEmojiStr(emojiName: string, noteUserHost: string | null) {
		const match = emojiName.match(parseEmojiStrRegexp);
		if (!match) return { name: null, host: null };

		const name = match[1];

		// ホスト正規化
		const host = this.utilityService.toPunyNullable(this.normalizeHost(match[2], noteUserHost));

		return { name, host };
	}

	/**
	 * 添付用(リモート)カスタム絵文字URLを解決する
	 * @param emojiName ノートやユーザープロフィールに添付された、またはリアクションのカスタム絵文字名 (:は含めない, リアクションでローカルホストの場合は@.を付ける (これはdecodeReactionで可能))
	 * @param noteUserHost ノートやユーザープロフィールの所有者のホスト
	 * @returns URL, nullは未マッチを意味する
	 */
	@bindThis
	public async populateEmoji(emojiName: string, noteUserHost: string | null): Promise<string | null> {
		const { name, host } = this.parseEmojiStr(emojiName, noteUserHost);
		if (name == null) return null;
		if (host == null) return null;

		const queryOrNull = async () => (await this.prismaService.client.emoji.findFirst({
			where: { name, host: host ?? null },
		})) ?? null;

		const emoji = await this.cache.fetch(`${name} ${host}`, queryOrNull);

		if (emoji == null) return null;
		return emoji.publicUrl || emoji.originalUrl; // || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
	}

	/**
	 * 複数の添付用(リモート)カスタム絵文字URLを解決する (キャシュ付き, 存在しないものは結果から除外される)
	 */
	@bindThis
	public async populateEmojis(emojiNames: string[], noteUserHost: string | null): Promise<Record<string, string>> {
		const emojis = await Promise.all(emojiNames.map(x => this.populateEmoji(x, noteUserHost)));
		const res = {} as any;
		for (let i = 0; i < emojiNames.length; i++) {
			if (emojis[i] != null) {
				res[emojiNames[i]] = emojis[i];
			}
		}
		return res;
	}

	/**
	 * 与えられた絵文字のリストをデータベースから取得し、キャッシュに追加します
	 */
	@bindThis
	public async prefetchEmojis(emojis: { name: string; host: string | null; }[]): Promise<void> {
		const notCachedEmojis = emojis.filter(emoji => this.cache.get(`${emoji.name} ${emoji.host}`) == null);
		const emojisQuery: Prisma.emojiWhereInput[] = [];
		const hosts = new Set(notCachedEmojis.map(e => e.host));
		for (const host of hosts) {
			if (host == null) continue;
			emojisQuery.push({
				name: { in: notCachedEmojis.filter(e => e.host === host).map(e => e.name) },
				host: host,
			});
		}
		const _emojis = emojisQuery.length > 0 ? await this.prismaService.client.emoji.findMany({
			where: { OR: emojisQuery },
		}) : [];
		for (const emoji of _emojis) {
			this.cache.set(`${emoji.name} ${emoji.host}`, emoji);
		}
	}

	@bindThis
	public dispose(): void {
		this.cache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
