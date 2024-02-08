import { setTimeout } from 'node:timers/promises';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { z } from 'zod';
import type { note, user } from '@prisma/client';

@Injectable()
export class NoteReadService implements OnApplicationShutdown {
	readonly #shutdownController = new AbortController();

	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async insertNoteUnread(
		userId: user['id'],
		note: note,
		params: {
			// NOTE: isSpecifiedがtrueならisMentionedは必ずfalse
			isSpecified: boolean;
			isMentioned: boolean;
		},
	): Promise<void> {
		//#region ミュートしているなら無視
		const mute = await this.prismaService.client.userMuting.findMany({
			where: { muterId: userId },
		});
		if (mute.map((m) => m.muteeId).includes(note.userId)) return;
		//#endregion

		// スレッドミュート
		const isThreadMuted =
			(await this.prismaService.client.note_thread_muting.count({
				where: {
					userId: userId,
					threadId: note.threadId ?? note.id,
				},
				take: 1,
			})) > 0;
		if (isThreadMuted) return;

		const unread = {
			id: this.idService.genId(),
			noteId: note.id,
			userId: userId,
			isSpecified: params.isSpecified,
			isMentioned: params.isMentioned,
			noteUserId: note.userId,
		};

		await this.prismaService.client.note_unread.create({ data: unread });

		// 2秒経っても既読にならなかったら「未読の投稿がありますよ」イベントを発行する
		setTimeout(2000, 'unread note', {
			signal: this.#shutdownController.signal,
		}).then(
			async () => {
				const exist =
					(await this.prismaService.client.note_unread.count({
						where: { id: unread.id },
						take: 1,
					})) > 0;

				if (!exist) return;

				if (params.isMentioned) {
					this.globalEventService.publishMainStream(
						userId,
						'unreadMention',
						note.id,
					);
				}
				if (params.isSpecified) {
					this.globalEventService.publishMainStream(
						userId,
						'unreadSpecifiedNote',
						note.id,
					);
				}
			},
			() => {
				/* aborted, ignore it */
			},
		);
	}

	public async read(
		userId: user['id'],
		notes: (note | z.infer<typeof NoteSchema>)[],
	): Promise<void> {
		const readMentions: (note | z.infer<typeof NoteSchema>)[] = [];
		const readSpecifiedNotes: (note | z.infer<typeof NoteSchema>)[] = [];

		for (const note of notes) {
			if (note.mentions && note.mentions.includes(userId)) {
				readMentions.push(note);
			} else if (note.visibleUserIds && note.visibleUserIds.includes(userId)) {
				readSpecifiedNotes.push(note);
			}
		}

		if (readMentions.length > 0 || readSpecifiedNotes.length > 0) {
			// Remove the record
			await this.prismaService.client.note_unread.deleteMany({
				where: {
					userId: userId,
					noteId: {
						in: [
							...readMentions.map((n) => n.id),
							...readSpecifiedNotes.map((n) => n.id),
						],
					},
				},
			});

			this.prismaService.client.note_unread
				.count({
					where: {
						userId: userId,
						isMentioned: true,
					},
				})
				.then((mentionsCount) => {
					if (mentionsCount === 0) {
						// 全て既読になったイベントを発行
						this.globalEventService.publishMainStream(
							userId,
							'readAllUnreadMentions',
						);
					}
				});

			this.prismaService.client.note_unread
				.count({
					where: {
						userId: userId,
						isSpecified: true,
					},
				})
				.then((specifiedCount) => {
					if (specifiedCount === 0) {
						// 全て既読になったイベントを発行
						this.globalEventService.publishMainStream(
							userId,
							'readAllUnreadSpecifiedNotes',
						);
					}
				});
		}
	}

	public dispose(): void {
		this.#shutdownController.abort();
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
