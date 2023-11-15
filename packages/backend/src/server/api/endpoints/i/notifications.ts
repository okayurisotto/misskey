import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { obsoleteNotificationTypes, notificationTypes } from '@/types.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteReadService } from '@/core/NoteReadService.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { IdService } from '@/core/IdService.js';
import { NotificationSchema } from '@/models/zod/NotificationSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisService } from '@/core/RedisService.js';

const RedisNotificationSchema = z.object({
	id: z.string(),
	createdAt: z.string(),
	type: z.enum(notificationTypes),
	notifierId: z.string().nullable().optional(),
	noteId: z.string().nullable().optional(),
	followRequestId: z.string().nullable().optional(),
	reaction: z.string().nullable().optional(),
	choice: z.number().nullable().optional(),
	achievement: z.string().nullable().optional(),
	customBody: z.string().nullable().optional(),
	customHeader: z.string().nullable().optional(),
	customIcon: z.string().nullable().optional(),
	appAccessTokenId: z.string().nullable().optional(),
});

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

export const paramDef = z
	.object({
		limit: limit({ max: 100, default: 10 }),
		markAsRead: z.boolean().default(true),
		includeTypes: z
			.array(z.enum([...notificationTypes, ...obsoleteNotificationTypes]))
			.optional(),
		excludeTypes: z
			.array(z.enum([...notificationTypes, ...obsoleteNotificationTypes]))
			.optional(),
	})
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly redisClient: RedisService,

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
				.map((x) => RedisNotificationSchema.parse(JSON.parse(x[1][1])))
				.filter((x) => x.id !== ps.untilId && x.id !== ps.sinceId);

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
