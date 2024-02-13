import { setTimeout } from 'node:timers/promises';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { Notification } from '@/models/entities/Notification.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PushNotificationService } from '@/core/PushNotificationService.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisService } from '@/core/RedisService.js';
import type { User } from '@prisma/client';

@Injectable()
export class NotificationService implements OnApplicationShutdown {
	readonly #shutdownController = new AbortController();

	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly notificationEntityService: NotificationEntityService,
		private readonly prismaService: PrismaService,
		private readonly pushNotificationService: PushNotificationService,
		private readonly redisClient: RedisService,
	) {}

	public async readAllNotification(
		userId: string,
		force = false,
	): Promise<void> {
		const latestReadNotificationId = await this.redisClient.get(
			`latestReadNotification:${userId}`,
		);

		const latestNotificationIdsRes = await this.redisClient.xrevrange(
			`notificationTimeline:${userId}`,
			'+',
			'-',
			'COUNT',
			1,
		);
		const latestNotificationId = latestNotificationIdsRes[0]?.[0];

		if (latestNotificationId == null) return;

		this.redisClient.set(
			`latestReadNotification:${userId}`,
			latestNotificationId,
		);

		if (
			force ||
			latestReadNotificationId == null ||
			latestReadNotificationId < latestNotificationId
		) {
			return this.postReadAllNotifications(userId);
		}
	}

	private postReadAllNotifications(userId: User['id']): void {
		this.globalEventService.publishMainStream(userId, 'readAllNotifications');
		this.pushNotificationService.pushNotification(
			userId,
			'readAllNotifications',
			undefined,
		);
	}

	public async createNotification(
		notifieeId: string,
		type: Notification['type'],
		data: Partial<Omit<Notification, 'id' | 'createdAt' | 'type'>>,
	): Promise<Notification | null> {
		const profile =
			await this.prismaService.client.user_profile.findUniqueOrThrow({
				where: { userId: notifieeId },
			});
		const isMuted = profile.mutingNotificationTypes.includes(type);
		if (isMuted) return null;

		if (data.notifierId) {
			if (notifieeId === data.notifierId) {
				return null;
			}

			const mutings = new Set(
				(
					await this.prismaService.client.userMuting.findMany({
						where: { muterId: notifieeId },
						select: { muteeId: true },
					})
				).map(({ muteeId }) => muteeId),
			);
			if (mutings.has(data.notifierId)) {
				return null;
			}
		}

		const notification: Notification = {
			id: this.idService.genId(),
			createdAt: new Date().toISOString(),
			type: type,
			...data,
		};

		const redisIdPromise = this.redisClient.xadd(
			`notificationTimeline:${notifieeId}`,
			'MAXLEN',
			'~',
			'300',
			'*',
			'data',
			JSON.stringify(notification),
		);

		const packed = await this.notificationEntityService.pack(
			notification,
			notifieeId,
			{},
		);

		// Publish notification event
		this.globalEventService.publishMainStream(
			notifieeId,
			'notification',
			packed,
		);

		// 2秒経っても(今回作成した)通知が既読にならなかったら「未読の通知がありますよ」イベントを発行する
		setTimeout(2000, 'unread notification', {
			signal: this.#shutdownController.signal,
		}).then(
			async () => {
				const latestReadNotificationId = await this.redisClient.get(
					`latestReadNotification:${notifieeId}`,
				);
				if (
					latestReadNotificationId &&
					latestReadNotificationId >= (await redisIdPromise)!
				)
					return;

				this.globalEventService.publishMainStream(
					notifieeId,
					'unreadNotification',
					packed,
				);
				this.pushNotificationService.pushNotification(
					notifieeId,
					'notification',
					packed,
				);

				if (type === 'follow')
					this.emailNotificationFollow(
						notifieeId,
						await this.prismaService.client.user.findUniqueOrThrow({
							where: { id: data.notifierId! },
						}),
					);
				if (type === 'receiveFollowRequest')
					this.emailNotificationReceiveFollowRequest(
						notifieeId,
						await this.prismaService.client.user.findUniqueOrThrow({
							where: { id: data.notifierId! },
						}),
					);
			},
			() => {
				/* aborted, ignore it */
			},
		);

		return notification;
	}

	// TODO
	//const locales = await import('../../../../locales/index.js');

	// TODO: locale ファイルをクライアント用とサーバー用で分けたい

	private async emailNotificationFollow(
		userId: string,
		follower: User,
	): Promise<void> {
		/*
		const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
		if (!userProfile.email || !userProfile.emailNotificationTypes.includes('follow')) return;
		const locale = locales[userProfile.lang ?? 'ja-JP'];
		const i18n = new I18n(locale);
		// TODO: render user information html
		sendEmail(userProfile.email, i18n.t('_email._follow.title'), `${follower.name} (@${Acct.toString(follower)})`, `${follower.name} (@${Acct.toString(follower)})`);
		*/
	}

	private async emailNotificationReceiveFollowRequest(
		userId: string,
		follower: User,
	): Promise<void> {
		/*
		const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
		if (!userProfile.email || !userProfile.emailNotificationTypes.includes('receiveFollowRequest')) return;
		const locale = locales[userProfile.lang ?? 'ja-JP'];
		const i18n = new I18n(locale);
		// TODO: render user information html
		sendEmail(userProfile.email, i18n.t('_email._receiveFollowRequest.title'), `${follower.name} (@${Acct.toString(follower)})`, `${follower.name} (@${Acct.toString(follower)})`);
		*/
	}

	public dispose(): void {
		this.#shutdownController.abort();
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
