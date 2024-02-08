import { Injectable } from '@nestjs/common';
import type { Notification } from '@/models/entities/Notification.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { notificationTypes } from '@/types.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import type { NotificationSchema } from '@/models/zod/NotificationSchema.js';
import type { UserSchema } from '@/models/zod/UserSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { UserEntityPackLiteService } from './UserEntityPackLiteService.js';
import { NoteEntityPackService } from './NoteEntityPackService.js';
import type { z } from 'zod';
import type { access_token, note, user } from '@prisma/client';

const NOTE_REQUIRED_NOTIFICATION_TYPES = new Set<
	(typeof notificationTypes)[number]
>(['mention', 'reply', 'renote', 'quote', 'reaction', 'pollEnded']);

@Injectable()
export class NotificationEntityService  {
	constructor(
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	/**
	 * `Notification`をpackする。
	 *
	 * @param notification
	 * @param meId
	 * @param _options 使われていない。
	 * @param hint
	 * @returns
	 */
	public async pack(
		notification: Notification,
		meId: user['id'],
		_options: Record<PropertyKey, never>,
		hint?: {
			packedNotes: Map<note['id'], z.infer<typeof NoteSchema>>;
			packedUsers: Map<user['id'], z.infer<typeof UserSchema>>;
		},
	): Promise<z.infer<typeof NotificationSchema>> {
		const getToken = async (): Promise<access_token | null> => {
			if (notification.appAccessTokenId == null) return null;

			return await this.prismaService.client.access_token.findUniqueOrThrow({
				where: { id: notification.appAccessTokenId },
			});
		};

		const getNoteIfNeed = async (): Promise<
			z.infer<typeof NoteSchema> | undefined
		> => {
			if (!NOTE_REQUIRED_NOTIFICATION_TYPES.has(notification.type))
				return undefined;
			if (notification.noteId == null) return undefined;

			if (hint?.packedNotes == null) {
				return await this.noteEntityService.pack(
					notification.noteId,
					{ id: meId },
					{ detail: true },
				);
			} else {
				return hint.packedNotes.get(notification.noteId);
			}
		};

		const getUserIfNeed = async (): Promise<
			z.infer<typeof UserLiteSchema> | undefined
		> => {
			if (notification.notifierId == null) return undefined;
			if (hint?.packedUsers == null) {
				const notifier = await this.prismaService.client.user.findUniqueOrThrow(
					{ where: { id: notification.notifierId } },
				);
				return await this.userEntityPackLiteService.packLite(notifier);
			} else {
				return hint.packedUsers.get(notification.notifierId);
			}
		};

		const [token, noteIfNeed, userIfNeed] = await Promise.all([
			getToken(),
			getNoteIfNeed(),
			getUserIfNeed(),
		]);

		return {
			id: notification.id,
			createdAt: new Date(notification.createdAt).toISOString(),
			type: notification.type,
			userId: notification.notifierId,
			...(userIfNeed !== undefined ? { user: userIfNeed } : {}),
			...(noteIfNeed !== undefined ? { note: noteIfNeed } : {}),
			...(notification.type === 'reaction'
				? { reaction: notification.reaction }
				: {}),
			...(notification.type === 'achievementEarned'
				? { achievement: notification.achievement }
				: {}),
			...(notification.type === 'app'
				? {
						body: notification.customBody,
						header: notification.customHeader ?? token?.name,
						icon: notification.customIcon ?? token?.iconUrl,
				  }
				: {}),
		};
	}

	/**
	 * `Notification[]`をpackする。
	 *
	 * @param notifications
	 * @param meId
	 * @returns
	 */
	public async packMany(
		notifications: Notification[],
		meId: user['id'],
	): Promise<z.infer<typeof NotificationSchema>[]> {
		if (notifications.length === 0) return [];

		let validNotifications = notifications;

		const noteIds = validNotifications.map((x) => x.noteId).filter(isNotNull);
		const notes =
			noteIds.length > 0
				? await this.prismaService.client.note.findMany({
						where: { id: { in: noteIds } },
				  })
				: [];
		const packedNotesArray = await this.noteEntityService.packMany(
			notes,
			{ id: meId },
			{ detail: true },
		);
		const packedNotes = new Map(packedNotesArray.map((p) => [p.id, p]));

		validNotifications = validNotifications.filter(
			(x) => x.noteId == null || packedNotes.has(x.noteId),
		);

		const userIds = validNotifications
			.map((x) => x.notifierId)
			.filter(isNotNull);
		const users =
			userIds.length > 0
				? await this.prismaService.client.user.findMany({
						where: { id: { in: userIds } },
				  })
				: [];
		const packedUsersArray = await Promise.all(
			users.map((user) => this.userEntityPackLiteService.packLite(user)),
		);
		const packedUsers = new Map(packedUsersArray.map((p) => [p.id, p]));

		// 既に解決されたフォローリクエストの通知を除外
		const followRequestNotifications = validNotifications.filter(
			(x) => x.type === 'receiveFollowRequest',
		);
		if (followRequestNotifications.length > 0) {
			const reqs = await this.prismaService.client.followRequest.findMany({
				where: {
					followerId: {
						in: followRequestNotifications.map((x) => x.notifierId!),
					},
				},
			});
			validNotifications = validNotifications.filter(
				(x) =>
					x.type !== 'receiveFollowRequest' ||
					reqs.some((r) => r.followerId === x.notifierId),
			);
		}

		return await Promise.all(
			validNotifications.map((x) =>
				this.pack(x, meId, {}, { packedNotes, packedUsers }),
			),
		);
	}
}
