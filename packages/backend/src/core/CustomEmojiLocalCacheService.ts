import { Injectable } from '@nestjs/common';
import { RedisSingleCache } from '@/misc/RedisSingleCache.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisService } from '@/core/RedisService.js';
import type { CustomEmoji } from '@prisma/client';
import type { Jsonify } from 'type-fest';

@Injectable()
export class CustomEmojiLocalCacheService extends RedisSingleCache<
	Map<string, CustomEmoji>
> {
	constructor(prismaService: PrismaService, redisClient: RedisService) {
		super(redisClient, 'localEmojis', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60 * 3, // 3m
			fetcher: async (): Promise<Map<string, CustomEmoji>> => {
				const emojis = await prismaService.client.customEmoji.findMany({
					where: { host: null },
				});
				return new Map(emojis.map((emoji) => [emoji.name, emoji]));
			},
			toRedisConverter: (value): string =>
				JSON.stringify(Array.from(value.values())),
			fromRedisConverter: (value): Map<string, CustomEmoji> | undefined => {
				if (!Array.isArray(JSON.parse(value))) {
					// 古いバージョンの壊れたキャッシュが残っていることがある(そのうち消す)
					return undefined;
				}

				return new Map(
					JSON.parse(value).map((x: Jsonify<CustomEmoji>) => [
						x.name,
						{ ...x, updatedAt: x.updatedAt ? new Date(x.updatedAt) : null },
					]),
				);
			},
		});
	}
}
