import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import type { IMentionedRemoteUsers } from '@/models/entities/Note.js';
import { RelayService } from '@/core/RelayService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import NotesChart from '@/core/chart/charts/notes.js';
import PerUserNotesChart from '@/core/chart/charts/per-user-notes.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { MetaService } from '@/core/MetaService.js';
import { SearchService } from '@/core/SearchService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import { RenoteCountService } from './entities/RenoteCountService.js';
import type { Prisma, Note, User } from '@prisma/client';
import type { IActivity } from './activitypub/type.js';

@Injectable()
export class NoteDeleteService {
	constructor(
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly apRendererService: ApRendererService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly globalEventService: GlobalEventService,
		private readonly instanceChart: InstanceChart,
		private readonly metaService: MetaService,
		private readonly notesChart: NotesChart,
		private readonly perUserNotesChart: PerUserNotesChart,
		private readonly prismaService: PrismaService,
		private readonly relayService: RelayService,
		private readonly renoteCountService: RenoteCountService,
		private readonly searchService: SearchService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * ノートを削除する。
	 *
	 * @param user ノート作成ユーザー
	 * @param note ノート
	 * @param quiet `true`だった場合、アクティビティ配送やチャート更新などを行わない。
	 */
	public async delete(
		user: {
			id: User['id'];
			uri: User['uri'];
			host: User['host'];
			isBot: User['isBot'];
		},
		note: Note,
		quiet = false,
	): Promise<void> {
		const deletedAt = new Date();
		const cascadingNotes = await this.findCascadingNotes(note.id);

		// 当該ノートがリノートで、なおかつ当該ノートを除く同一ユーザーによる同一ノートのリノートが存在しなかった場合、renoteCountとscoreを減少させる。
		if (note.renoteId) {
			const sameRenotesCount = await this.renoteCountService.countSameRenotes(
				user.id,
				note.renoteId,
				note.id,
			);
			if (sameRenotesCount === 0) {
				if (user.isBot) {
					await this.prismaService.client.note.update({
						where: { id: note.renoteId },
						data: { renoteCount: { decrement: 1 } },
					});
				} else {
					await this.prismaService.client.note.update({
						where: { id: note.renoteId },
						data: { renoteCount: { decrement: 1 }, score: { decrement: 1 } },
					});
				}
			}
		}

		// 当該ノートがリプライだった場合、repliesCountを減少させる。
		if (note.replyId) {
			await this.prismaService.client.note.update({
				where: { id: note.replyId },
				data: { repliesCount: { decrement: 1 } },
			});
		}

		if (!quiet) {
			const meta = await this.metaService.fetch();

			// 削除イベントをRedisへ送信する。
			this.globalEventService.publishNoteStream(note.id, 'deleted', {
				deletedAt: deletedAt,
			});

			// 当該ノートがローカルのものだった場合、削除アクティビティを配送する。
			if (this.userEntityUtilService.isLocalUser(user) && !note.localOnly) {
				if (
					note.renoteId &&
					note.text == null &&
					!note.hasPoll &&
					note.fileIds.length === 0
				) {
					// 当該ノートがリノートだった場合、undoとして配送する。
					const renote = await this.prismaService.client.note.findUniqueOrThrow(
						{ where: { id: note.renoteId } },
					);
					const content = this.apRendererService.addContext(
						this.apRendererService.renderUndo(
							this.apRendererService.renderAnnounce(
								renote.uri ??
									`${this.configLoaderService.data.url}/notes/${renote.id}`,
								note,
							),
							user,
						),
					);

					await this.deliverToConcerned(user, note, content);
				} else {
					// 当該ノートがリノートではなかった場合、deleteとして配送する。
					const content = this.apRendererService.addContext(
						this.apRendererService.renderDelete(
							this.apRendererService.renderTombstone(
								`${this.configLoaderService.data.url}/notes/${note.id}`,
							),
							user,
						),
					);

					await this.deliverToConcerned(user, note, content);
				}
			}

			// 当該ノートを参照するノートに関しても、削除アクティビティを配送する。
			await Promise.all(
				cascadingNotes
					.filter((note) => !note.localOnly)
					.filter((note) => note.userHost == null)
					.map(async (note) => {
						if (!this.userEntityUtilService.isLocalUser(note.user)) {
							return;
						}
						const content = this.apRendererService.addContext(
							this.apRendererService.renderDelete(
								this.apRendererService.renderTombstone(
									`${this.configLoaderService.data.url}/notes/${note.id}`,
								),
								note.user,
							),
						);
						await this.deliverToConcerned(note.user, note, content);
					}),
			);

			// ユーザーごとのノートのチャートを更新する。
			await this.notesChart.update(note, false);
			if (meta.enableChartsForRemoteUser || user.host == null) {
				this.perUserNotesChart.update(user, note, false);
			}

			// 当該ノートの作成者がリモートユーザーだった場合、インスタンスのチャートを更新する。
			if (this.userEntityUtilService.isRemoteUser(user)) {
				const instance = await this.federatedInstanceService.fetch(user.host);
				await this.prismaService.client.instance.update({
					where: { id: instance.id },
					data: { notesCount: { decrement: 1 } },
				});
				if (meta.enableChartsForFederatedInstances) {
					await this.instanceChart.updateNote(instance.host, note, false);
				}
			}
		}

		// 検索用のインデックスから当該ノート及び関連するすべてのノートを削除する。
		await Promise.all(
			[note, ...cascadingNotes].map(async (note) => {
				await this.searchService.unindexNote(note);
			}),
		);

		// データベースから当該ノートを削除する。
		// 関連するノートの削除はデータベース側がCASCADE削除するため明示的な指定は必要ない。
		await this.prismaService.client.note.delete({
			where: { id: note.id, userId: user.id },
		});
	}

	/**
	 * あるノートと関連したすべてのノートを再帰的に取得する。
	 * ここでいう「関連したノート」とは、「当該ノートへのリプライであるノート」と「当該ノートへの引用リノートであるノート」のこと。
	 *
	 * ノートの削除において、当該ノートと関連したノートの削除はデータベース側で（CASCADE設定によって）自動的に行われます。
	 * しかし実際の削除では、事前に削除アクティビティを配送するなどの処理が必要です。
	 * よって、データベースがCASCADE削除するノートをアプリケーション側でもこのように取得できるようにする必要があります。
	 */
	private async findCascadingNotes(
		noteId: string,
	): Promise<(Note & { user: User })[]> {
		const recursive = async (
			noteId: string,
		): Promise<(Note & { user: User })[]> => {
			const replies = await this.prismaService.client.note.findMany({
				where: {
					OR: [{ replyId: noteId }, { renoteId: noteId, text: { not: null } }],
				},
				include: { user: true },
			});

			return [
				replies,
				...(await Promise.all(replies.map((reply) => recursive(reply.id)))),
			].flat();
		};

		return await recursive(noteId);
	}

	private async getMentionedRemoteUsers(note: Note): Promise<RemoteUser[]> {
		const where: Prisma.UserWhereInput[] = [];

		// mention / reply / dm
		const uris = (
			JSON.parse(note.mentionedRemoteUsers) as IMentionedRemoteUsers
		).map((x) => x.uri);
		if (uris.length > 0) {
			where.push({ uri: { in: uris } });
		}

		// renote / quote
		if (note.renoteUserId) {
			where.push({ id: note.renoteUserId });
		}

		if (where.length === 0) return [];

		return (await this.prismaService.client.user.findMany({
			where: { OR: where },
		})) as RemoteUser[];
	}

	private async deliverToConcerned(
		user: { id: LocalUser['id']; host: null },
		note: Note,
		content: IActivity,
	): Promise<void> {
		await this.apDeliverManagerService.deliverToFollowers(user, content);
		await this.relayService.deliverToRelays(user, content);
		const remoteUsers = await this.getMentionedRemoteUsers(note);
		await Promise.all(
			remoteUsers.map(async (remoteUser) => {
				await this.apDeliverManagerService.deliverToUser(
					user,
					content,
					remoteUser,
				);
			}),
		);
	}
}
