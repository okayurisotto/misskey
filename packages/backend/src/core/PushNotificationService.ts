import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import push from 'web-push';
import * as Redis from 'ioredis';
import type { sw_subscription } from '@prisma/client';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { getNoteSummary } from '@/misc/get-note-summary.js';
import type { SwSubscription } from '@/models/index.js';
import { MetaService } from '@/core/MetaService.js';
import { bindThis } from '@/decorators.js';
import { RedisKVCache } from '@/misc/cache.js';
import type { NotificationSchema } from '@/models/zod/NotificationSchema.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { z } from 'zod';

// Defined also packages/sw/types.ts#L13
type PushNotificationsTypes = {
	'notification': z.infer<typeof NotificationSchema>;
	'unreadAntennaNote': {
		antenna: { id: string, name: string };
		note: z.infer<typeof NoteSchema>;
	};
	'readAllNotifications': undefined;
};

// Reduce length because push message servers have character limits
function truncateBody<T extends keyof PushNotificationsTypes>(type: T, body: PushNotificationsTypes[T]): PushNotificationsTypes[T] {
	if (typeof body !== 'object') return body;

	return {
		...body,
		...(('note' in body && body.note) ? {
			note: {
				...body.note,
				// textをgetNoteSummaryしたものに置き換える
				text: getNoteSummary(('type' in body && body.type === 'renote') ? body.note.renote as z.infer<typeof NoteSchema> : body.note),

				cw: undefined,
				reply: undefined,
				renote: undefined,
				user: type === 'notification' ? undefined as any : body.note.user,
			},
		} : {}),
	};
}

@Injectable()
export class PushNotificationService implements OnApplicationShutdown {
	private subscriptionsCache: RedisKVCache<sw_subscription[]>;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
	) {
		this.subscriptionsCache = new RedisKVCache<sw_subscription[]>(this.redisClient, 'userSwSubscriptions', {
			lifetime: 1000 * 60 * 60 * 1, // 1h
			memoryCacheLifetime: 1000 * 60 * 3, // 3m
			fetcher: (key) => this.prismaService.client.sw_subscription.findMany({ where: { userId: key } }),
			toRedisConverter: (value) => JSON.stringify(value),
			fromRedisConverter: (value) => JSON.parse(value),
		});
	}

	@bindThis
	public async pushNotification<T extends keyof PushNotificationsTypes>(userId: string, type: T, body: PushNotificationsTypes[T]) {
		const meta = await this.metaService.fetch();

		if (!meta.enableServiceWorker || meta.swPublicKey == null || meta.swPrivateKey == null) return;

		// アプリケーションの連絡先と、サーバーサイドの鍵ペアの情報を登録
		push.setVapidDetails(this.config.url,
			meta.swPublicKey,
			meta.swPrivateKey);

		const subscriptions = await this.subscriptionsCache.fetch(userId);

		for (const subscription of subscriptions) {
			if ([
				'readAllNotifications',
			].includes(type) && !subscription.sendReadMessage) continue;

			const pushSubscription = {
				endpoint: subscription.endpoint,
				keys: {
					auth: subscription.auth,
					p256dh: subscription.publickey,
				},
			};

			push.sendNotification(pushSubscription, JSON.stringify({
				type,
				body: (type === 'notification' || type === 'unreadAntennaNote') ? truncateBody(type, body) : body,
				userId,
				dateTime: (new Date()).getTime(),
			}), {
				proxy: this.config.proxy,
			}).catch(async (err: any) => {
				//swLogger.info(err.statusCode);
				//swLogger.info(err.headers);
				//swLogger.info(err.body);

				if (err.statusCode === 410) {
					const result = await this.prismaService.client.sw_subscription.findFirst({
						where: {
							userId: userId,
							endpoint: subscription.endpoint,
							auth: subscription.auth,
							publickey: subscription.publickey,
						},
					});
					if (result) {
						this.prismaService.client.sw_subscription.delete({ where: { id: result.id } });
					}
				}
			});
		}
	}

	@bindThis
	public dispose(): void {
		this.subscriptionsCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
