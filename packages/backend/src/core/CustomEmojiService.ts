import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { fromEntries } from 'omick';
import { IdService } from '@/core/IdService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { bindThis } from '@/decorators.js';
import { MemoryKVCache, RedisSingleCache } from '@/misc/cache.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { RedisService } from '@/core/RedisService.js';
import type { Prisma, role, drive_file, emoji } from '@prisma/client';
import type { Jsonify } from 'type-fest';

const parseEmojiStrRegexp = /^(\w+)(?:@([\w.-]+))?$/;

@Injectable()
export class CustomEmojiService implements OnApplicationShutdown {
	private readonly cache: MemoryKVCache<emoji | null>;
	public localEmojisCache: RedisSingleCache<Map<string, emoji>>;

	constructor(
		private readonly redisClient: RedisService,

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
			fetcher: async (): Promise<Map<string, emoji>> => {
				const emojis = await this.prismaService.client.emoji.findMany({
					where: { host: null },
				});
				return new Map(emojis.map(emoji => [emoji.name, emoji]));
			},
			toRedisConverter: (value): string => JSON.stringify(Array.from(value.values())),
			fromRedisConverter: (value): Map<string, emoji> | undefined => {
				if (!Array.isArray(JSON.parse(value))) return undefined; // 古いバージョンの壊れたキャッシュが残っていることがある(そのうち消す)
				return new Map(JSON.parse(value).map((x: Jsonify<emoji>) => [x.name, {
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

		if (data.host === null) {
			await this.localEmojisCache.refresh();

			this.globalEventService.publishBroadcastStream('emojiAdded', {
				emoji: this.emojiEntityService.packDetailed(emoji.id, { emoji: new EntityMap('id', [emoji]) }),
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

		await this.localEmojisCache.refresh();

		const updated = this.emojiEntityService.packDetailed(emoji.id, { emoji: new EntityMap('id', [emoji]) });

		if (emoji.name === data.name) {
			this.globalEventService.publishBroadcastStream('emojiUpdated', {
				emojis: [updated],
			});
		} else {
			this.globalEventService.publishBroadcastStream('emojiDeleted', {
				emojis: [this.emojiEntityService.packDetailed(emoji.id, { emoji: new EntityMap('id', [emoji]) })],
			});

			this.globalEventService.publishBroadcastStream('emojiAdded', {
				emoji: updated,
			});
		}
	}

	@bindThis
	public async addAliasesBulk(ids: emoji['id'][], aliases: string[]): Promise<void> {
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

		await this.localEmojisCache.refresh();

		const data = {
			emoji: new EntityMap('id', emojis),
		};

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) => this.emojiEntityService.packDetailed(emoji.id, data)),
		});
	}

	@bindThis
	public async setAliasesBulk(ids: emoji['id'][], aliases: string[]): Promise<void> {
		await this.prismaService.client.emoji.updateMany({
			where: { id: { in: ids } },
			data: {
				updatedAt: new Date(),
				aliases: aliases,
			},
		});

		await this.localEmojisCache.refresh();

		const emojis = await this.prismaService.client.emoji.findMany({
			where: { id: { in: ids } },
		});
		const data = { emoji: new EntityMap('id', emojis) };

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) => this.emojiEntityService.packDetailed(emoji.id, data)),
		});
	}

	@bindThis
	public async removeAliasesBulk(ids: emoji['id'][], aliases: string[]): Promise<void> {
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

		await this.localEmojisCache.refresh();

		const data = { emoji: new EntityMap('id', emojis) };

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) => this.emojiEntityService.packDetailed(emoji.id, data)),
		});
	}

	@bindThis
	public async setCategoryBulk(ids: emoji['id'][], category: string | null): Promise<void> {
		await this.prismaService.client.emoji.updateMany({
			where: { id: { in: ids } },
			data: {
				updatedAt: new Date(),
				category: category,
			},
		});

		await this.localEmojisCache.refresh();

		const emojis = await this.prismaService.client.emoji.findMany({
			where: { id: { in: ids } },
		});
		const data = { emoji: new EntityMap('id', emojis) };

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) => this.emojiEntityService.packDetailed(emoji.id, data)),
		});
	}

	@bindThis
	public async setLicenseBulk(ids: emoji['id'][], license: string | null): Promise<void> {
		await this.prismaService.client.emoji.updateMany({
			where: { id: { in: ids } },
			data: {
				updatedAt: new Date(),
				license: license,
			},
		});

		await this.localEmojisCache.refresh();

		const emojis = await this.prismaService.client.emoji.findMany({
			where: { id: { in: ids } },
		});
		const data = { emoji: new EntityMap('id', emojis) };

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: emojis.map((emoji) => this.emojiEntityService.packDetailed(emoji.id, data)),
		});
	}

	@bindThis
	public async delete(id: emoji['id']): Promise<void> {
		const emoji = await this.prismaService.client.emoji.delete({ where: { id } });

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiDeleted', {
			emojis: [this.emojiEntityService.packDetailed(emoji.id, { emoji: new EntityMap('id', [emoji]) })],
		});
	}

	@bindThis
	public async deleteBulk(ids: emoji['id'][]): Promise<void> {
		const emojis = await this.prismaService.client.emoji.findMany({ where: { id: { in: ids } } });

		for (const emoji of emojis) {
			await this.prismaService.client.emoji.delete({ where: { id: emoji.id } });
		}

		await this.localEmojisCache.refresh();

		const data = { emoji: new EntityMap('id', emojis) };

		this.globalEventService.publishBroadcastStream('emojiDeleted', {
			emojis: emojis.map((emoji) => this.emojiEntityService.packDetailed(emoji.id, data)),
		});
	}

	@bindThis
	private normalizeHost(src: string | undefined, noteUserHost: string | null): string | null {
		const host = ((): string | null => {
			// .はローカルホスト (ここがマッチするのはリアクションのみ)
			if (src === '.') return null;

			// ノートなどでホスト省略表記の場合はローカルホスト (ここがリアクションにマッチすることはない)
			if (src === undefined) return noteUserHost;

			// 自ホスト指定
			if (this.utilityService.isSelfHost(src)) return null;

			// 指定されたホスト || ノートなどの所有者のホスト (こっちがリアクションにマッチすることはない)
			return src || noteUserHost;
		})();

		return this.utilityService.toPunyNullable(host);
	}

	@bindThis
	public parseEmojiStr(
		emojiName: string,
		noteUserHost: string | null,
	): { name: null; host: null } | { name: string | undefined; host: string | null } {
		const match = emojiName.match(parseEmojiStrRegexp);
		if (!match) return { name: null, host: null };

		const name = match.at(1);

		// ホスト正規化
		const host = this.utilityService.toPunyNullable(this.normalizeHost(match.at(2), noteUserHost));

		return { name, host };
	}

	/**
	 * 複数の添付用（リモート）カスタム絵文字URLを解決する（存在しないものは結果から除外される）
	 *
	 * @param emojiNames ノートやユーザープロフィールに添付された、またはリアクションのカスタム絵文字名（`:`は含めない。リアクションでローカルホストの場合は`@.`を付ける（これはdecodeReactionで可能））
	 * @param host       ノートやユーザープロフィールの所有者のホスト
	 */
	@bindThis
	public async populateEmojis(emojiNames: string[], host: string | null): Promise<Record<string, string>> {
		const parsedEmojiNames = emojiNames
			.map((emojiName) => {
				const result = this.parseEmojiStr(emojiName, host);
				if (result.name == null) return null;
				if (result.host === null) return null;

				return { value: emojiName, result: result };
			})
			.filter(isNotNull);

		const emojis = await this.prismaService.client.emoji.findMany({
			where: { OR: parsedEmojiNames.map(({ result: specifier }) => specifier) },
		});

		const entries = emojis
			.map<[string, string] | null>((emoji) => {
				const emojiName = parsedEmojiNames.find((entry) => {
					return entry.result.host === emoji.host && entry.result.name === emoji.name;
				});

				if (emojiName === undefined) return null;

				// 後方互換性のため
				const emojiUrl = emoji.publicUrl === '' ? emoji.originalUrl : emoji.publicUrl;

				return [emojiName.value, emojiUrl];
			})
			.filter(isNotNull);

		return fromEntries(entries);
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
	public onApplicationShutdown(): void {
		this.dispose();
	}
}
