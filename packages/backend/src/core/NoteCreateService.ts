import { setImmediate } from 'node:timers/promises';
import * as mfm from 'mfm-js';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import RE2 from 're2';
import { z } from 'zod';
import { range } from 'range';
import { extractMentions } from '@/misc/extract-mentions.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import type { IMentionedRemoteUsers } from '@/models/entities/Note.js';
import { concat } from '@/misc/prelude/array.js';
import { IdService } from '@/core/IdService.js';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import type { IPoll } from '@/models/entities/Poll.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import { checkWordMute } from '@/misc/check-word-mute.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { MemorySingleCache } from '@/misc/cache.js';
import { RelayService } from '@/core/RelayService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import NotesChart from '@/core/chart/charts/notes.js';
import PerUserNotesChart from '@/core/chart/charts/per-user-notes.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { WebhookService } from '@/core/WebhookService.js';
import { HashtagService } from '@/core/HashtagService.js';
import { AntennaService } from '@/core/AntennaService.js';
import { QueueService } from '@/core/QueueService.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import {
	AddContext,
	ApRendererService,
} from '@/core/activitypub/ApRendererService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { NoteReadService } from '@/core/NoteReadService.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DB_MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { RoleService } from '@/core/RoleService.js';
import { MetaService } from '@/core/MetaService.js';
import { SearchService } from '@/core/SearchService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisService } from '@/core/RedisService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { IAnnounce, ICreate } from './activitypub/type.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import { RenoteCountService } from './entities/RenoteCountService.js';
import type {
	Prisma,
	App,
	Channel,
	DriveFile,
	note,
	user,
	user_profile,
} from '@prisma/client';

const mutedWordsCache = new MemorySingleCache<
	{ userId: user_profile['userId']; mutedWords: user_profile['mutedWords'] }[]
>(1000 * 60 * 5);

type NotificationType = 'reply' | 'renote' | 'quote' | 'mention';

class NotificationManager {
	private readonly notifier: { id: user['id'] };
	private readonly note: note;
	private readonly queue: {
		target: LocalUser['id'];
		reason: NotificationType;
	}[];

	constructor(
		private readonly notificationService: NotificationService,
		private readonly prismaService: PrismaService,
		notifier: { id: user['id'] },
		note: note,
	) {
		this.notifier = notifier;
		this.note = note;
		this.queue = [];
	}

	public push(notifiee: LocalUser['id'], reason: NotificationType): void {
		// 自分自身へは通知しない
		if (this.notifier.id === notifiee) return;

		const exist = this.queue.find((x) => x.target === notifiee);

		if (exist) {
			// 「メンションされているかつ返信されている」場合は、メンションとしての通知ではなく返信としての通知にする
			if (reason !== 'mention') {
				exist.reason = reason;
			}
		} else {
			this.queue.push({
				reason: reason,
				target: notifiee,
			});
		}
	}

	public async deliver(): Promise<void> {
		for (const x of this.queue) {
			// ミュート情報を取得
			const mentioneeMutes = await this.prismaService.client.muting.findMany({
				where: { muterId: x.target },
			});

			const mentioneesMutedUserIds = mentioneeMutes.map((m) => m.muteeId);

			// 通知される側のユーザーが通知する側のユーザーをミュートしていない限りは通知する
			if (!mentioneesMutedUserIds.includes(this.notifier.id)) {
				this.notificationService.createNotification(x.target, x.reason, {
					notifierId: this.notifier.id,
					noteId: this.note.id,
				});
			}
		}
	}
}

type MinimumUser = {
	id: user['id'];
	host: user['host'];
	username: user['username'];
	uri: user['uri'];
};

type Option = {
	createdAt?: Date | null;
	name?: string | null;
	text?: string | null;
	reply?: note | null;
	renote?: note | null;
	files?: DriveFile[] | null;
	poll?: IPoll | null;
	localOnly?: boolean | null;
	reactionAcceptance?: note['reactionAcceptance'];
	cw?: string | null;
	visibility?: string;
	visibleUsers?: MinimumUser[] | null;
	channel?: Channel | null;
	apMentions?: MinimumUser[] | null;
	apHashtags?: string[] | null;
	apEmojis?: string[] | null;
	uri?: string | null;
	url?: string | null;
	app?: App | null;
};

@Injectable()
export class NoteCreateService implements OnApplicationShutdown {
	readonly #shutdownController = new AbortController();

	constructor(
		private readonly activeUsersChart: ActiveUsersChart,
		private readonly antennaService: AntennaService,
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly apRendererService: ApRendererService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly globalEventService: GlobalEventService,
		private readonly hashtagService: HashtagService,
		private readonly idService: IdService,
		private readonly instanceChart: InstanceChart,
		private readonly metaService: MetaService,
		private readonly noteEntityService: NoteEntityPackService,
		private readonly noteReadService: NoteReadService,
		private readonly notesChart: NotesChart,
		private readonly notificationService: NotificationService,
		private readonly perUserNotesChart: PerUserNotesChart,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly redisClient: RedisService,
		private readonly relayService: RelayService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly renoteCountService: RenoteCountService,
		private readonly roleService: RoleService,
		private readonly searchService: SearchService,
		private readonly userEntityUtilService: UserEntityUtilService,
		private readonly webhookService: WebhookService,
	) {}

	public async create(
		user: {
			id: user['id'];
			username: user['username'];
			host: user['host'];
			createdAt: user['createdAt'];
			isBot: user['isBot'];
		},
		data: Option,
		silent = false,
	): Promise<note> {
		// チャンネル外にリプライしたら対象のスコープに合わせる
		// (クライアントサイドでやっても良い処理だと思うけどとりあえずサーバーサイドで)
		if (
			data.reply &&
			data.channel &&
			data.reply.channelId !== data.channel.id
		) {
			if (data.reply.channelId) {
				data.channel = await this.prismaService.client.channel.findUnique({
					where: { id: data.reply.channelId },
				});
			} else {
				data.channel = null;
			}
		}

		// チャンネル内にリプライしたら対象のスコープに合わせる
		// (クライアントサイドでやっても良い処理だと思うけどとりあえずサーバーサイドで)
		if (data.reply && data.channel == null && data.reply.channelId) {
			data.channel = await this.prismaService.client.channel.findUnique({
				where: { id: data.reply.channelId },
			});
		}

		if (data.createdAt == null) data.createdAt = new Date();
		if (data.visibility == null) data.visibility = 'public';
		if (data.localOnly == null) data.localOnly = false;
		if (data.channel != null) data.visibility = 'public';
		if (data.channel != null) data.visibleUsers = [];
		if (data.channel != null) data.localOnly = true;

		if (data.visibility === 'public' && data.channel == null) {
			const sensitiveWords = (await this.metaService.fetch()).sensitiveWords;
			if (this.isSensitive(data, sensitiveWords)) {
				data.visibility = 'home';
			} else if (
				!(await this.roleService.getUserPolicies(user.id)).canPublicNote
			) {
				data.visibility = 'home';
			}
		}

		// Renote対象が「ホームまたは全体」以外の公開範囲ならreject
		if (
			data.renote &&
			data.renote.visibility !== 'public' &&
			data.renote.visibility !== 'home' &&
			data.renote.userId !== user.id
		) {
			throw new Error('Renote target is not public or home');
		}

		// Renote対象がpublicではないならhomeにする
		if (
			data.renote &&
			data.renote.visibility !== 'public' &&
			data.visibility === 'public'
		) {
			data.visibility = 'home';
		}

		// Renote対象がfollowersならfollowersにする
		if (data.renote && data.renote.visibility === 'followers') {
			data.visibility = 'followers';
		}

		// 返信対象がpublicではないならhomeにする
		if (
			data.reply &&
			data.reply.visibility !== 'public' &&
			data.visibility === 'public'
		) {
			data.visibility = 'home';
		}

		// ローカルのみをRenoteしたらローカルのみにする
		if (data.renote && data.renote.localOnly && data.channel == null) {
			data.localOnly = true;
		}

		// ローカルのみにリプライしたらローカルのみにする
		if (data.reply && data.reply.localOnly && data.channel == null) {
			data.localOnly = true;
		}

		if (data.text) {
			if (data.text.length > DB_MAX_NOTE_TEXT_LENGTH) {
				data.text = data.text.slice(0, DB_MAX_NOTE_TEXT_LENGTH);
			}
			data.text = data.text.trim();
		} else {
			data.text = null;
		}

		let tags = data.apHashtags;
		let emojis = data.apEmojis;
		let mentionedUsers = data.apMentions;

		// Parse MFM if needed
		if (!tags || !emojis || !mentionedUsers) {
			const tokens = data.text ? mfm.parse(data.text) : [];
			const cwTokens = data.cw ? mfm.parse(data.cw) : [];
			const choiceTokens =
				data.poll && data.poll.choices
					? concat(data.poll.choices.map((choice) => mfm.parse(choice)))
					: [];

			const combinedTokens = tokens.concat(cwTokens).concat(choiceTokens);

			tags = data.apHashtags ?? extractHashtags(combinedTokens);

			emojis = data.apEmojis ?? extractCustomEmojisFromMfm(combinedTokens);

			mentionedUsers =
				data.apMentions ??
				(await this.extractMentionedUsers(user, combinedTokens));
		}

		tags = tags
			.filter((tag) => Array.from(tag ?? '').length <= 128)
			.splice(0, 32);

		if (
			data.reply &&
			user.id !== data.reply.userId &&
			!mentionedUsers.some((u) => u.id === data.reply!.userId)
		) {
			mentionedUsers.push(
				await this.prismaService.client.user.findUniqueOrThrow({
					where: { id: data.reply.userId },
				}),
			);
		}

		if (data.visibility === 'specified') {
			if (data.visibleUsers == null) throw new Error('invalid param');

			for (const u of data.visibleUsers) {
				if (!mentionedUsers.some((x) => x.id === u.id)) {
					mentionedUsers.push(u);
				}
			}

			if (
				data.reply &&
				!data.visibleUsers.some((x) => x.id === data.reply!.userId)
			) {
				data.visibleUsers.push(
					await this.prismaService.client.user.findUniqueOrThrow({
						where: { id: data.reply.userId },
					}),
				);
			}
		}

		const note = await this.insertNote(
			user,
			data,
			tags,
			emojis,
			mentionedUsers,
		);

		if (data.channel) {
			this.redisClient.xadd(
				`channelTimeline:${data.channel.id}`,
				'MAXLEN',
				'~',
				'1000',
				'*',
				'note',
				note.id,
			);
		}

		setImmediate('post created', {
			signal: this.#shutdownController.signal,
		}).then(
			() =>
				this.postNoteCreated(note, user, data, silent, tags!, mentionedUsers!),
			() => {
				/* aborted, ignore this */
			},
		);

		return note;
	}

	private async insertNote(
		user: Pick<user, 'id' | 'host'>,
		data: Option,
		tags: string[],
		emojis: string[],
		mentionedUsers: MinimumUser[],
	): Promise<note> {
		const insert: Prisma.noteUncheckedCreateInput = {
			id: this.idService.genId(data.createdAt!),
			createdAt: data.createdAt!,
			fileIds: data.files ? data.files.map((file) => file.id) : [],
			replyId: data.reply ? data.reply.id : null,
			renoteId: data.renote ? data.renote.id : null,
			channelId: data.channel ? data.channel.id : null,
			threadId: data.reply
				? data.reply.threadId
					? data.reply.threadId
					: data.reply.id
				: null,
			name: data.name,
			text: data.text,
			hasPoll: data.poll != null,
			cw: data.cw == null ? null : data.cw,
			tags: tags.map((tag) => normalizeForSearch(tag)),
			emojis,
			userId: user.id,
			localOnly: data.localOnly!,
			reactionAcceptance: data.reactionAcceptance,
			visibility: data.visibility as any,
			visibleUserIds:
				data.visibility === 'specified'
					? data.visibleUsers
						? data.visibleUsers.map((u) => u.id)
						: []
					: [],

			attachedFileTypes: data.files ? data.files.map((file) => file.type) : [],

			// 以下非正規化データ
			replyUserId: data.reply ? data.reply.userId : null,
			replyUserHost: data.reply ? data.reply.userHost : null,
			renoteUserId: data.renote ? data.renote.userId : null,
			renoteUserHost: data.renote ? data.renote.userHost : null,
			userHost: user.host,
		};

		if (data.uri != null) insert.uri = data.uri;
		if (data.url != null) insert.url = data.url;

		// Append mentions data
		if (mentionedUsers.length > 0) {
			insert.mentions = mentionedUsers.map((u) => u.id);
			const profiles = await this.prismaService.client.user_profile.findMany({
				where: { userId: { in: insert.mentions } },
			});
			insert.mentionedRemoteUsers = JSON.stringify(
				mentionedUsers
					.filter((u) => this.userEntityUtilService.isRemoteUser(u))
					.map((u) => {
						const profile = profiles.find((p) => p.userId === u.id);
						const url = profile != null ? profile.url : null;
						return {
							uri: u.uri,
							url: url == null ? undefined : url,
							username: u.username,
							host: u.host,
						} as IMentionedRemoteUsers[0];
					}),
			);
		}

		// 投稿を作成
		try {
			if (data.poll && insert.hasPoll) {
				return await this.prismaService.client.note.create({
					data: {
						...insert,
						user: undefined,
						channel: undefined,

						poll: {
							create: {
								choices: data.poll.choices,
								expiresAt: data.poll.expiresAt,
								multiple: data.poll.multiple,
								votes: range({ stop: data.poll.choices.length }).fill(0),
								noteVisibility: insert.visibility,
								userId: user.id,
								userHost: user.host,
							},
						},
					},
				});
			} else {
				return await this.prismaService.client.note.create({
					data: {
						...insert,
						user: undefined,
						channel: undefined,
					},
				});
			}
		} catch (e) {
			// duplicate key error
			if (isDuplicateKeyValueError(e)) {
				const err = new Error('Duplicated note');
				err.name = 'duplicated';
				throw err;
			}

			console.error(e);

			throw e;
		}
	}

	private async postNoteCreated(
		note: note,
		user: {
			id: user['id'];
			username: user['username'];
			host: user['host'];
			createdAt: user['createdAt'];
			isBot: user['isBot'];
		},
		data: Option,
		silent: boolean,
		tags: string[],
		mentionedUsers: MinimumUser[],
	): Promise<void> {
		const meta = await this.metaService.fetch();

		this.notesChart.update(note, true);
		if (meta.enableChartsForRemoteUser || user.host == null) {
			this.perUserNotesChart.update(user, note, true);
		}

		// Register host
		if (this.userEntityUtilService.isRemoteUser(user)) {
			this.federatedInstanceService.fetch(user.host).then(async (i) => {
				this.prismaService.client.instance.update({
					where: { id: i.id },
					data: { notesCount: { increment: 1 } },
				});
				if (
					(await this.metaService.fetch()).enableChartsForFederatedInstances
				) {
					this.instanceChart.updateNote(i.host, note, true);
				}
			});
		}

		// ハッシュタグ更新
		if (data.visibility === 'public' || data.visibility === 'home') {
			this.hashtagService.updateHashtags(user, tags);
		}

		// Increment notes count (user)
		await this.incNotesCountOfUser(user);

		// Word mute
		mutedWordsCache
			.fetch(() => {
				return this.prismaService.client.user_profile
					.findMany({ where: { enableWordMute: true } })
					.then((notes) => {
						return notes.map((note) => ({
							...note,
							mutedWords: z.array(z.array(z.string())).parse(note.mutedWords),
						}));
					});
			})
			.then((us) => {
				for (const u of us) {
					const shouldMute = checkWordMute(
						note,
						{ id: u.userId },
						z.array(z.array(z.string())).parse(u.mutedWords),
					);
					if (shouldMute) {
						this.prismaService.client.muted_note.create({
							data: {
								id: this.idService.genId(),
								userId: u.userId,
								noteId: note.id,
								reason: 'word',
							},
						});
					}
				}
			});

		this.antennaService.addNoteToAntennas(note, user);

		if (data.reply) {
			await this.saveReply(data.reply, note);
		}

		// この投稿を除く指定したユーザーによる指定したノートのリノートが存在しないとき
		if (
			data.renote &&
			(await this.renoteCountService.countSameRenotes(
				user.id,
				data.renote.id,
				note.id,
			)) === 0
		) {
			if (!user.isBot) this.incRenoteCount(data.renote);
		}

		if (data.poll && data.poll.expiresAt) {
			const delay = data.poll.expiresAt.getTime() - Date.now();
			this.queueService.endedPollNotificationQueue.add(
				note.id,
				{
					noteId: note.id,
				},
				{
					delay,
					removeOnComplete: true,
				},
			);
		}

		if (!silent) {
			if (this.userEntityUtilService.isLocalUser(user))
				this.activeUsersChart.write(user);

			// 未読通知を作成
			if (data.visibility === 'specified') {
				if (data.visibleUsers == null) throw new Error('invalid param');

				for (const u of data.visibleUsers) {
					// ローカルユーザーのみ
					if (!this.userEntityUtilService.isLocalUser(u)) continue;

					this.noteReadService.insertNoteUnread(u.id, note, {
						isSpecified: true,
						isMentioned: false,
					});
				}
			} else {
				for (const u of mentionedUsers) {
					// ローカルユーザーのみ
					if (!this.userEntityUtilService.isLocalUser(u)) continue;

					this.noteReadService.insertNoteUnread(u.id, note, {
						isSpecified: false,
						isMentioned: true,
					});
				}
			}

			// Pack the note
			const noteObj = await this.noteEntityService.pack(note);

			this.globalEventService.publishNotesStream(noteObj);

			this.roleService.addNoteToRoleTimeline(noteObj);

			this.webhookService.getActiveWebhooks().then((webhooks) => {
				webhooks = webhooks.filter(
					(x) => x.userId === user.id && x.on.includes('note'),
				);
				for (const webhook of webhooks) {
					this.queueService.webhookDeliver(webhook, 'note', {
						note: noteObj,
					});
				}
			});

			const nm = new NotificationManager(
				this.notificationService,
				this.prismaService,
				user,
				note,
			);

			await this.createMentionedEvents(mentionedUsers, note, nm);

			// If has in reply to note
			if (data.reply) {
				// 通知
				if (data.reply.userHost === null) {
					const isThreadMuted =
						(await this.prismaService.client.note_thread_muting.count({
							where: {
								userId: data.reply.userId,
								threadId: data.reply.threadId ?? data.reply.id,
							},
							take: 1,
						})) > 0;

					if (!isThreadMuted) {
						nm.push(data.reply.userId, 'reply');
						this.globalEventService.publishMainStream(
							data.reply.userId,
							'reply',
							noteObj,
						);

						const webhooks = (
							await this.webhookService.getActiveWebhooks()
						).filter(
							(x) => x.userId === data.reply!.userId && x.on.includes('reply'),
						);
						for (const webhook of webhooks) {
							this.queueService.webhookDeliver(webhook, 'reply', {
								note: noteObj,
							});
						}
					}
				}
			}

			// If it is renote
			if (data.renote) {
				const type = data.text ? 'quote' : 'renote';

				// Notify
				if (data.renote.userHost === null) {
					nm.push(data.renote.userId, type);
				}

				// Publish event
				if (user.id !== data.renote.userId && data.renote.userHost === null) {
					this.globalEventService.publishMainStream(
						data.renote.userId,
						'renote',
						noteObj,
					);

					const webhooks = (
						await this.webhookService.getActiveWebhooks()
					).filter(
						(x) => x.userId === data.renote!.userId && x.on.includes('renote'),
					);
					for (const webhook of webhooks) {
						this.queueService.webhookDeliver(webhook, 'renote', {
							note: noteObj,
						});
					}
				}
			}

			nm.deliver();

			//#region AP deliver
			if (this.userEntityUtilService.isLocalUser(user)) {
				const noteActivity = await this.renderNoteOrRenoteActivity(data, note);
				const dm = this.apDeliverManagerService.createDeliverManager(
					user,
					noteActivity,
				);

				// メンションされたリモートユーザーに配送
				for (const u of mentionedUsers.filter((u) =>
					this.userEntityUtilService.isRemoteUser(u),
				)) {
					dm.addDirectRecipe(u as RemoteUser);
				}

				// 投稿がリプライかつ投稿者がローカルユーザーかつリプライ先の投稿の投稿者がリモートユーザーなら配送
				if (data.reply && data.reply.userHost !== null) {
					const u = await this.prismaService.client.user.findUnique({
						where: { id: data.reply.userId },
					});
					if (u && this.userEntityUtilService.isRemoteUser(u)) {
						dm.addDirectRecipe(u);
					}
				}

				// 投稿がRenoteかつ投稿者がローカルユーザーかつRenote元の投稿の投稿者がリモートユーザーなら配送
				if (data.renote && data.renote.userHost !== null) {
					const u = await this.prismaService.client.user.findUnique({
						where: { id: data.renote.userId },
					});
					if (u && this.userEntityUtilService.isRemoteUser(u)) {
						dm.addDirectRecipe(u);
					}
				}

				// フォロワーに配送
				if (['public', 'home', 'followers'].includes(note.visibility)) {
					dm.addFollowersRecipe();
				}

				if (['public'].includes(note.visibility)) {
					this.relayService.deliverToRelays(user, noteActivity);
				}

				dm.execute();
			}
			//#endregion
		}

		// Register to search database
		this.index(note);
	}

	private isSensitive(note: Option, sensitiveWord: string[]): boolean {
		if (sensitiveWord.length > 0) {
			const text = note.cw ?? note.text ?? '';
			if (text === '') return false;
			const matched = sensitiveWord.some((filter) => {
				// represents RegExp
				const regexp = filter.match(/^\/(.+)\/(.*)$/);
				// This should never happen due to input sanitisation.
				if (!regexp) {
					const words = filter.split(' ');
					return words.every((keyword) => text.includes(keyword));
				}
				try {
					return new RE2(regexp[1], regexp[2]).test(text);
				} catch (err) {
					// This should never happen due to input sanitisation.
					return false;
				}
			});
			if (matched) return true;
		}
		return false;
	}

	private incRenoteCount(renote: note): void {
		this.prismaService.client.note.update({
			where: { id: renote.id },
			data: {
				renoteCount: { increment: 1 },
				score: { increment: 1 },
			},
		});
	}

	private async createMentionedEvents(
		mentionedUsers: MinimumUser[],
		note: note,
		nm: NotificationManager,
	): Promise<void> {
		for (const u of mentionedUsers.filter((u) =>
			this.userEntityUtilService.isLocalUser(u),
		)) {
			const isThreadMuted =
				(await this.prismaService.client.note_thread_muting.count({
					where: {
						userId: u.id,
						threadId: note.threadId ?? note.id,
					},
					take: 1,
				})) > 0;

			if (isThreadMuted) {
				continue;
			}

			const detailPackedNote = await this.noteEntityService.pack(note, u, {
				detail: true,
			});

			this.globalEventService.publishMainStream(
				u.id,
				'mention',
				detailPackedNote,
			);

			const webhooks = (await this.webhookService.getActiveWebhooks()).filter(
				(x) => x.userId === u.id && x.on.includes('mention'),
			);
			for (const webhook of webhooks) {
				this.queueService.webhookDeliver(webhook, 'mention', {
					note: detailPackedNote,
				});
			}

			// Create notification
			nm.push(u.id, 'mention');
		}
	}

	private async saveReply(reply: note, note: note): Promise<void> {
		await this.prismaService.client.note.update({
			where: { id: reply.id },
			data: { repliesCount: { increment: 1 } },
		});
	}

	private async renderNoteOrRenoteActivity(
		data: Option,
		note: note,
	): Promise<AddContext<IAnnounce | ICreate> | null> {
		if (data.localOnly) return null;

		const content =
			data.renote &&
			data.text == null &&
			data.poll == null &&
			(data.files == null || data.files.length === 0)
				? this.apRendererService.renderAnnounce(
						data.renote.uri
							? data.renote.uri
							: `${this.configLoaderService.data.url}/notes/${data.renote.id}`,
						note,
				  )
				: this.apRendererService.renderCreate(
						await this.apRendererService.renderNote(note, false),
						note,
				  );

		return this.apRendererService.addContext(content);
	}

	private index(note: note): void {
		if (note.text == null && note.cw == null) return;

		this.searchService.indexNote(note);
	}

	private async incNotesCountOfUser(user: { id: user['id'] }): Promise<void> {
		await this.prismaService.client.user.update({
			where: { id: user.id },
			data: {
				updatedAt: new Date(),
				notesCount: { increment: 1 },
			},
		});
	}

	private async extractMentionedUsers(
		user: { host: user['host'] },
		tokens: mfm.MfmNode[],
	): Promise<user[]> {
		if (tokens == null) return [];

		const mentions = extractMentions(tokens);
		let mentionedUsers = (
			await Promise.all(
				mentions.map((m) =>
					this.remoteUserResolveService
						.resolveUser(m.username, m.host ?? user.host)
						.catch(() => null),
				),
			)
		).filter((x): x is LocalUser | RemoteUser => x != null);

		// Drop duplicate users
		mentionedUsers = mentionedUsers.filter(
			(u, i, self) => i === self.findIndex((u2) => u.id === u2.id),
		);

		return mentionedUsers;
	}

	public dispose(): void {
		this.#shutdownController.abort();
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
