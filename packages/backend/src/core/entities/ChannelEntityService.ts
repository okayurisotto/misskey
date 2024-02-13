import { Injectable } from '@nestjs/common';
import type { ChannelSchema } from '@/models/zod/ChannelSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { NoteEntityPackService } from './NoteEntityPackService.js';
import { DriveFilePublicUrlGenerationService } from './DriveFilePublicUrlGenerationService.js';
import type { z } from 'zod';
import type { Channel, User } from '@prisma/client';

@Injectable()
export class ChannelEntityService {
	constructor(
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,
		private readonly driveFilePublicUrlGenerationService: DriveFilePublicUrlGenerationService,
	) {}

	/**
	 * `channel`をpackする。
	 *
	 * @param src
	 * @param me       渡された場合、返り値に`isFavorited`と`isFollowing`と`hasUnreadNote`が含まれるようになる。
	 * @param detailed `true`だった場合、返り値に`pinnedNotes`が含まれるようになる。
	 * @returns
	 */
	public async pack(
		src: Channel['id'] | Channel,
		me?: { id: User['id'] } | null | undefined,
		detailed?: boolean,
	): Promise<z.infer<typeof ChannelSchema>> {
		const meId = me ? me.id : null;

		// Channelとそのbannerを取得する。
		const { banner, ...channel } =
			await this.prismaService.client.channel.findUniqueOrThrow({
				where: { id: typeof src === 'string' ? src : src.id },
				include: { banner: true },
			});

		// 当該Channelと関連したNoteについて集計する。
		// Channel取得クエリとまとめたかったものの、書き方が分からなかったため別に取得することにした。
		const {
			_count: notesCount,
			_max: { createdAt: lastNotedAt },
		} = await this.prismaService.client.note.aggregate({
			where: { channelId: channel.id },
			_count: true,
			_max: { createdAt: true },
		});

		// 当該Channelと関連したNoteを作成したUserを数え上げる。
		// Channel取得クエリとまとめたかったものの、書き方が分からなかったため別に取得することにした。
		// `distinct`を使ってuserIdについてユニークになったNote[]を取得した上で`.length`すればよかった？
		// しかし数え上げることが目的なのに値を取得してしまうのはどうなんだろうか？
		const usersCount = await this.prismaService.client.user.count({
			where: { notes: { some: { channelId: channel.id } } },
		});

		// 当該Channelとmeとの関係性を取得する。
		// Channel取得クエリとまとめてもよかったが、`meId`が`null`になり得ることを考えたとき面倒だったため別に取得することにした。
		const [isFavorited, isFollowing, hasUnreadNote] = await (async (): Promise<
			[boolean, boolean, boolean] | []
		> => {
			if (meId === null) return [];

			// 存在確認が目的なので`aggregate`などで済ませられたらよかったが、`aggregate`には`_exist`のようなものはなく、またそもそも`include`が使えないようなので断念した。
			const result = await this.prismaService.client.user.findUniqueOrThrow({
				where: { id: meId },
				include: {
					channelFavorites: { where: { channelId: channel.id }, take: 1 },
					channelFollowings: { where: { channelId: channel.id }, take: 1 },
					// note_unread: { where: { noteChannelId: channel.id }, take: 1 },
					noteUnreads: { where: { note: { channelId: channel.id } }, take: 1 },
				},
			});

			return [
				result.channelFavorites.length > 0,
				result.channelFollowings.length > 0,
				result.noteUnreads.length > 0,
			];
		})();

		// 当該Channelにピン留めされたNoteを取得する。
		// 非正規化されているためこうするしかなかった。
		const pinnedNotes =
			channel.pinnedNoteIds.length > 0
				? await this.prismaService.client.note.findMany({
						where: { id: { in: channel.pinnedNoteIds } },
				  })
				: [];

		return {
			id: channel.id,
			createdAt: channel.createdAt.toISOString(),
			lastNotedAt: lastNotedAt?.toISOString() ?? null,
			name: channel.name,
			description: channel.description,
			userId: channel.userId,
			bannerUrl: banner
				? this.driveFilePublicUrlGenerationService.generate(banner)
				: null,
			pinnedNoteIds: channel.pinnedNoteIds,
			color: channel.color,
			isArchived: channel.isArchived,
			usersCount: usersCount,
			notesCount: notesCount,

			...{ hasUnreadNote, isFavorited, isFollowing },

			...(detailed
				? {
						pinnedNotes: (
							await this.noteEntityService.packMany(pinnedNotes, me)
						).sort((a, b) => {
							// データベースから取得した`pinnedNotes`は`pinnedNoteIds`と並び順が変わってしまっているのでソートし直す必要がある。
							return (
								channel.pinnedNoteIds.indexOf(a.id) -
								channel.pinnedNoteIds.indexOf(b.id)
							);
						}),
				  }
				: {}),
		};
	}
}
