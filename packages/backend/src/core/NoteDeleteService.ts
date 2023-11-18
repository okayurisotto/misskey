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
import type { note, user } from '@prisma/client';

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
	 * 投稿を削除します。
	 * @param user 投稿者
	 * @param note 投稿
	 */
	async delete(
		user: {
			id: user['id'];
			uri: user['uri'];
			host: user['host'];
			isBot: user['isBot'];
		},
		note: note,
		quiet = false,
	): Promise<void> {
		const deletedAt = new Date();
		const cascadingNotes = await this.findCascadingNotes(note);

		// この投稿を除く指定したユーザーによる指定したノートのリノートが存在しないとき
		if (
			note.renoteId &&
			(await this.renoteCountService.countSameRenotes(
				user.id,
				note.renoteId,
				note.id,
			)) === 0
		) {
			this.prismaService.client.note.update({
				where: { id: note.renoteId },
				data: { renoteCount: { decrement: 1 } },
			});
			if (!user.isBot)
				this.prismaService.client.note.update({
					where: { id: note.renoteId },
					data: { score: { decrement: 1 } },
				});
		}

		if (note.replyId) {
			await this.prismaService.client.note.update({
				where: { id: note.replyId },
				data: { repliesCount: { decrement: 1 } },
			});
		}

		if (!quiet) {
			this.globalEventService.publishNoteStream(note.id, 'deleted', {
				deletedAt: deletedAt,
			});

			//#region ローカルの投稿なら削除アクティビティを配送
			if (this.userEntityUtilService.isLocalUser(user) && !note.localOnly) {
				let renote: note | null = null;

				// if deletd note is renote
				if (
					note.renoteId &&
					note.text == null &&
					!note.hasPoll &&
					(note.fileIds == null || note.fileIds.length === 0)
				) {
					renote = await this.prismaService.client.note.findUnique({
						where: { id: note.renoteId },
					});
				}

				const content = this.apRendererService.addContext(
					renote
						? this.apRendererService.renderUndo(
								this.apRendererService.renderAnnounce(
									renote.uri ??
										`${this.configLoaderService.data.url}/notes/${renote.id}`,
									note,
								),
								user,
						  )
						: this.apRendererService.renderDelete(
								this.apRendererService.renderTombstone(
									`${this.configLoaderService.data.url}/notes/${note.id}`,
								),
								user,
						  ),
				);

				this.deliverToConcerned(user, note, content);
			}

			// also deliever delete activity to cascaded notes
			const federatedLocalCascadingNotes = cascadingNotes.filter(
				(note) => !note.localOnly && note.userHost == null,
			); // filter out local-only notes
			for (const cascadingNote of federatedLocalCascadingNotes) {
				if (!cascadingNote.user) continue;
				if (!this.userEntityUtilService.isLocalUser(cascadingNote.user)) {
					continue;
				}
				const content = this.apRendererService.addContext(
					this.apRendererService.renderDelete(
						this.apRendererService.renderTombstone(
							`${this.configLoaderService.data.url}/notes/${cascadingNote.id}`,
						),
						cascadingNote.user,
					),
				);
				this.deliverToConcerned(cascadingNote.user, cascadingNote, content);
			}
			//#endregion

			const meta = await this.metaService.fetch();

			this.notesChart.update(note, false);
			if (meta.enableChartsForRemoteUser || user.host == null) {
				this.perUserNotesChart.update(user, note, false);
			}

			if (this.userEntityUtilService.isRemoteUser(user)) {
				this.federatedInstanceService.fetch(user.host).then(async (i) => {
					this.prismaService.client.instance.update({
						where: { id: i.id },
						data: { notesCount: { decrement: 1 } },
					});
					if (
						(await this.metaService.fetch()).enableChartsForFederatedInstances
					) {
						this.instanceChart.updateNote(i.host, note, false);
					}
				});
			}
		}

		for (const cascadingNote of cascadingNotes) {
			this.searchService.unindexNote(cascadingNote);
		}
		this.searchService.unindexNote(note);

		await this.prismaService.client.note.delete({
			where: {
				id: note.id,
				userId: user.id,
			},
		});
	}

	private async findCascadingNotes(
		note: note,
	): Promise<(note & { user: user | null })[]> {
		const recursive = async (
			noteId: string,
		): Promise<(note & { user: user | null })[]> => {
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

		const cascadingNotes = await recursive(note.id);

		return cascadingNotes;
	}

	private async getMentionedRemoteUsers(note: note): Promise<RemoteUser[]> {
		const where = [];

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
		note: note,
		content: any,
	): Promise<void> {
		this.apDeliverManagerService.deliverToFollowers(user, content);
		this.relayService.deliverToRelays(user, content);
		const remoteUsers = await this.getMentionedRemoteUsers(note);
		for (const remoteUser of remoteUsers) {
			this.apDeliverManagerService.deliverToUser(user, content, remoteUser);
		}
	}
}
