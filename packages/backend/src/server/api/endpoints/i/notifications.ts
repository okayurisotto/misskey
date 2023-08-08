import { z } from 'zod';
import * as Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';
import { obsoleteNotificationTypes, notificationTypes } from '@/types.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteReadService } from '@/core/NoteReadService.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { Notification } from '@/models/entities/Notification.js';
import { NotificationSchema } from '@/models/zod/NotificationSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(NotificationSchema);
export const meta = {
	tags: ['account', 'notifications'],
	requireCredential: true,
	limit: {
		duration: 30000,
		max: 30,
	},
	kind: 'read:notifications',
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	markAsRead: z.boolean().default(true),
	includeTypes: z
		.array(z.enum([...notificationTypes, ...obsoleteNotificationTypes]))
		.optional(),
	excludeTypes: z
		.array(z.enum([...notificationTypes, ...obsoleteNotificationTypes]))
		.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.redis)
		private readonly redisClient: Redis.Redis,

		private readonly idService: IdService,
		private readonly notificationEntityService: NotificationEntityService,
		private readonly notificationService: NotificationService,
		private readonly noteReadService: NoteReadService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// includeTypes が空の場合はクエリしない
			if (ps.includeTypes && ps.includeTypes.length === 0) {
				return [];
			}
			// excludeTypes に全指定されている場合はクエリしない
			if (notificationTypes.every((type) => ps.excludeTypes?.includes(type))) {
				return [];
			}

			const includeTypes =
				ps.includeTypes &&
				(ps.includeTypes.filter(
					(type) => !obsoleteNotificationTypes.includes(type as any),
				) as (typeof notificationTypes)[number][]);
			const excludeTypes =
				ps.excludeTypes &&
				(ps.excludeTypes.filter(
					(type) => !obsoleteNotificationTypes.includes(type as any),
				) as (typeof notificationTypes)[number][]);

			const limit = ps.limit + (ps.untilId ? 1 : 0) + (ps.sinceId ? 1 : 0); // untilIdに指定したものも含まれるため+1
			const notificationsRes = await this.redisClient.xrevrange(
				`notificationTimeline:${me.id}`,
				ps.untilId ? this.idService.parse(ps.untilId).date.getTime() : '+',
				ps.sinceId ? this.idService.parse(ps.sinceId).date.getTime() : '-',
				'COUNT',
				limit,
			);

			if (notificationsRes.length === 0) {
				return [];
			}

			let notifications = notificationsRes
				.map((x) => JSON.parse(x[1][1]))
				.filter(
					(x) => x.id !== ps.untilId && x !== ps.sinceId,
				) as Notification[];

			if (includeTypes && includeTypes.length > 0) {
				notifications = notifications.filter((notification) =>
					includeTypes.includes(notification.type),
				);
			} else if (excludeTypes && excludeTypes.length > 0) {
				notifications = notifications.filter(
					(notification) => !excludeTypes.includes(notification.type),
				);
			}

			if (notifications.length === 0) {
				return [];
			}

			// Mark all as read
			if (ps.markAsRead) {
				this.notificationService.readAllNotification(me.id);
			}

			const noteIds = notifications
				.filter((notification) =>
					['mention', 'reply', 'quote'].includes(notification.type),
				)
				.map((notification) => notification.noteId!);

			if (noteIds.length > 0) {
				const notes = await this.prismaService.client.note.findMany({
					where: { id: { in: noteIds } },
				});
				this.noteReadService.read(me.id, notes);
			}

			return (await this.notificationEntityService.packMany(
				notifications,
				me.id,
			)) satisfies z.infer<typeof res>;
		});
	}
}
