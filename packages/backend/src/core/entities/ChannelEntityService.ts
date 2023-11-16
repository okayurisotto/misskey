import { Injectable } from '@nestjs/common';
import type { ChannelSchema } from '@/models/zod/ChannelSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import { NoteEntityService } from './NoteEntityService.js';
import type { z } from 'zod';
import type { channel, user } from '@prisma/client';

@Injectable()
export class ChannelEntityService {
	constructor(
		private readonly driveFileEntityService: DriveFileEntityService,
		private readonly noteEntityService: NoteEntityService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * `channel`をpackする。
	 *
	 * @param src
	 * @param me       渡された場合、返り値に`isFollowing`と`isFavorited`と`hasUnreadNote`が含まれるようになる。
	 * @param detailed `true`だった場合、返り値に`pinnedNotes`が含まれるようになる。
	 * @returns
	 */
	public async pack(
		src: channel['id'] | channel,
		me?: { id: user['id'] } | null | undefined,
		detailed?: boolean,
	): Promise<z.infer<typeof ChannelSchema>> {
		const channel = typeof src === 'object'
			? src
			: await this.prismaService.client.channel.findUniqueOrThrow({ where: { id: src } });
		const meId = me ? me.id : null;

		const banner = channel.bannerId
			? await this.prismaService.client.drive_file.findUnique({
				where: { id: channel.bannerId },
			})
			: null;

		const hasUnreadNote = meId
			? (await this.prismaService.client.note_unread.count({
				where: {
					noteChannelId: channel.id,
					userId: meId,
				},
				take: 1
			})) > 0
			: undefined;

		const isFollowing = meId
			? (await this.prismaService.client.channel_following.count({
				where: {
					followerId: meId,
					followeeId: channel.id,
				},
				take: 1,
			})) > 0
			: false;

		const isFavorited = meId
			? (await this.prismaService.client.channel_favorite.count({
				where: {
					userId: meId,
					channelId: channel.id,
				},
				take: 1,
			})) > 0
			: false;

		const pinnedNotes = channel.pinnedNoteIds.length > 0
			? await this.prismaService.client.note.findMany({
				where: {
					id: { in: channel.pinnedNoteIds },
				},
			})
			: [];

		return {
			id: channel.id,
			createdAt: channel.createdAt.toISOString(),
			lastNotedAt: channel.lastNotedAt ? channel.lastNotedAt.toISOString() : null,
			name: channel.name,
			description: channel.description,
			userId: channel.userId,
			bannerUrl: banner ? this.driveFileEntityService.getPublicUrl(banner) : null,
			pinnedNoteIds: channel.pinnedNoteIds,
			color: channel.color,
			isArchived: channel.isArchived,
			usersCount: channel.usersCount,
			notesCount: channel.notesCount,

			...(me ? {
				isFollowing,
				isFavorited,
				hasUnreadNote,
			} : {}),

			...(detailed ? {
				pinnedNotes: (await this.noteEntityService.packMany(pinnedNotes, me))
					.sort((a, b) => channel.pinnedNoteIds.indexOf(a.id) - channel.pinnedNoteIds.indexOf(b.id)),
			} : {}),
		};
	}
}
