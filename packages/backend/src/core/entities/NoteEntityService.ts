import { Injectable } from '@nestjs/common';
import * as mfm from 'mfm-js';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';
import { nyaize } from '@/misc/nyaize.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { bindThis } from '@/decorators.js';
import { isNotNull } from '@/misc/is-not-null.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import type { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { CustomEmojiService } from '../CustomEmojiService.js';
import type { ReactionService } from '../ReactionService.js';
import type { UserEntityService } from './UserEntityService.js';
import type { DriveFileEntityService } from './DriveFileEntityService.js';
import type { note, note_reaction, user } from '@prisma/client';

type PollChoice = {
	text: string;
	votes: number;
	isVoted: boolean;
};

type Poll = {
	multiple: boolean;
	expiresAt: Date | null;
	choices: PollChoice[];
};

const NoteReactionsSchema = z.record(z.string(), z.number());

/**
 * `MfmNode`を再帰的に`nyaize`する。
 *
 * @param node
 * @returns `node`の`text`プロパティがmutableに書き換えられるため関数自体の返り値はvoid。
 */
function nyaizeNode(node: mfm.MfmNode): void {
	if (node.type === 'quote') return;
	if (node.type === 'text') {
		node.props.text = nyaize(node.props.text);
	}
	if (node.children) {
		for (const child of node.children) {
			nyaizeNode(child);
		}
	}
}

@Injectable()
export class NoteEntityService implements OnModuleInit {
	private userEntityService: UserEntityService;
	private driveFileEntityService: DriveFileEntityService;
	private customEmojiService: CustomEmojiService;
	private reactionService: ReactionService;

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly prismaService: PrismaService,
	) {}

	onModuleInit(): void {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.driveFileEntityService = this.moduleRef.get('DriveFileEntityService');
		this.customEmojiService = this.moduleRef.get('CustomEmojiService');
		this.reactionService = this.moduleRef.get('ReactionService');
	}

	/**
	 * packされたnoteを閲覧者からの可視性に基づいて適切に隠す。
	 *
	 * @param packedNote packされたnote。このメソッドの実行によってmutableに書き換えられる。
	 * @param meId       閲覧者を指定するID。
	 * @returns          `mutable`なメソッドなため返り値はなし。
	 */
	@bindThis
	private async hideNote(packedNote: z.infer<typeof NoteSchema>, meId: user['id'] | null): Promise<void> {
		/** 隠すかどうか。隠す場合は`true`へ書き換えられる。 */
		let hide = false;

		// `visibility`が`'specified'` && 自分が指定されていない => 非表示
		if (packedNote.visibility === 'specified') {
			if (meId == null) {
				hide = true;
			} else if (meId === packedNote.userId) {
				hide = false;
			} else {
				/** `visibleUserIds`に`meId`が含まれるか */
				const specified = packedNote.visibleUserIds?.some((id) => meId === id) ?? false;

				hide = !specified;
			}
		}

		// `visibility`が`'followers'` && 自分が投稿者のフォロワーでない => 非表示
		if (packedNote.visibility === 'followers') {
			if (meId == null) {
				hide = true;
			} else if (meId === packedNote.userId) {
				hide = false;
			} else if (packedNote.reply && (meId === packedNote.reply.userId)) {
				// 自分の投稿に対するリプライだった場合は表示する
				hide = false;
			} else if (packedNote.mentions && packedNote.mentions.some(id => meId === id)) {
				// 自分へのメンションが含まれる場合は表示する
				hide = false;
			} else {
				/** 自分が投稿者のフォロワーかどうか */
				const isFollowing = await this.prismaService.client.following.count({
					where: {
						followeeId: packedNote.userId,
						followerId: meId,
					},
					take: 1,
				}) > 0;

				hide = !isFollowing;
			}
		}

		if (hide) {
			packedNote.visibleUserIds = undefined;
			packedNote.fileIds = [];
			packedNote.files = [];
			packedNote.text = null;
			packedNote.poll = undefined;
			packedNote.cw = null;
			packedNote.isHidden = true;
		}
	}

	/**
	 * `note`から`poll`を得る。
	 *
	 * @param note
	 * @param meId
	 * @returns `meId`が`null`でなかった場合、自身の投票結果が返り値の`isVoted`に`true`として表される。
	 */
	@bindThis
	private async populatePoll(note: note, meId: user['id'] | null): Promise<Poll> {
		const poll = await this.prismaService.client.poll.findUniqueOrThrow({ where: { noteId: note.id } });
		const choices = poll.choices.map(c => ({
			text: c,
			votes: poll.votes[poll.choices.indexOf(c)],
			isVoted: false,
		}));

		if (meId) {
			if (poll.multiple) {
				const votes = await this.prismaService.client.poll_vote.findMany({
					where: {
						userId: meId,
						noteId: note.id,
					},
				});

				const myChoices = votes.map(v => v.choice);
				for (const myChoice of myChoices) {
					choices[myChoice].isVoted = true;
				}
			} else {
				const vote = await this.prismaService.client.poll_vote.findFirst({
					where: {
						userId: meId,
						noteId: note.id,
					},
				});

				if (vote) {
					choices[vote.choice].isVoted = true;
				}
			}
		}

		return {
			multiple: poll.multiple,
			expiresAt: poll.expiresAt,
			choices,
		};
	}

	/**
	 * `note`からそれに自分がしたリアクションを得る。
	 * パフォーマンスのため当該`note`が作成されてから1秒以上が経過していない場合は`undefined`で早期`return`される。
	 *
	 * @param note
	 * @param meId
	 * @param _hint_ その`note`にされたリアクションの情報を含めておくと早期`return`される場合がある。
	 * @returns      リアクションが文字列（絵文字）もしくは文字列（カスタム絵文字の書式）として返される。自分がしたリアクションがなかった場合には`undefined`が返される。
	 */
	@bindThis
	private async populateMyReaction(
		note: note,
		meId: user['id'],
		_hint_?: {
			myReactions: Map<note['id'], note_reaction | null>;
		},
	): Promise<string | undefined> {
		if (_hint_?.myReactions) {
			const reaction = _hint_.myReactions.get(note.id);
			if (reaction) {
				return this.reactionService.convertLegacyReaction(reaction.reaction);
			} else if (reaction === null) {
				return undefined;
			}
			// 実装上抜けがあるだけかもしれないので、「ヒントに含まれていなかったら`return`」のようにはしない
		}

		// パフォーマンスのためノートが作成されてから1秒以上経っていない場合はリアクションを取得しない
		if (note.createdAt.getTime() + 1000 > Date.now()) {
			return undefined;
		}

		const reaction = await this.prismaService.client.note_reaction.findUnique({
			where: {
				userId_noteId: {
					userId: meId,
					noteId: note.id,
				},
			},
		});

		if (reaction) {
			return this.reactionService.convertLegacyReaction(reaction.reaction);
		}

		return undefined;
	}

	/**
	 * その`note`が`meId`で指定された閲覧者にとって閲覧可能か判定する。
	 *
	 * @param note
	 * @param meId
	 * @returns
	 */
	@bindThis
	public async isVisibleForMe(note: note, meId: user['id'] | null): Promise<boolean> {
		// This code must always be synchronized with the checks in generateVisibilityQuery.
		// `visibility`が`'specified'` && 自分が指定されていない => 非表示
		if (note.visibility === 'specified') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else {
				// 指定されているかどうか
				return note.visibleUserIds.some((id) => meId === id);
			}
		}

		// `visibility`が`'followers'` && 自分が投稿者のフォロワーでない => 非表示
		if (note.visibility === 'followers') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else if (meId === note.replyUserId) {
				// 自分の投稿に対するリプライだった場合は表示する
				return true;
			} else if (note.mentions.some(id => meId === id)) {
				// 自分へのメンションが含まれる場合は表示する
				return true;
			} else {
				// 自分が投稿者のフォロワーかどうか
				const [following, user] = await Promise.all([
					this.prismaService.client.following.count({
						where: {
							followeeId: note.userId,
							followerId: meId,
						},
						take: 1,
					}),
					this.prismaService.client.user.findUniqueOrThrow({ where: { id: meId } }),
				]);

				if (following > 0) {
					return true;
				} else {
					// `note`がリモートのもので、なおかつ`meId`によって指定される閲覧者もまたリモートのユーザーだった場合、visibleであると判定する
					// 閲覧者がリモートユーザーであることはほぼないと思われるが十分な確認はできていない。
					return note.userHost !== null && user.host !== null;
				}
			}
		}

		return true;
	}

	/**
	 * `note`にattachされた`file`をpackする。
	 *
	 * @param fileIds     `note.fileIds`のこと。
	 * @param packedFiles あらかじめpackされた`file`の`Map`。ここにないものはあとから取得され、追加される。
	 * @returns           packされた`file`。取得できなかった`file`に関しては除かれるため、`fileIds`と要素数が合わないこともなくはないはず。
	 */
	@bindThis
	public async packAttachedFiles(
		fileIds: note['fileIds'],
		packedFiles: Map<note['fileIds'][number], z.infer<typeof DriveFileSchema> | null>,
	): Promise<z.infer<typeof DriveFileSchema>[]> {
		const missingIds = [];
		for (const id of fileIds) {
			if (!packedFiles.has(id)) missingIds.push(id);
		}
		if (missingIds.length > 0) {
			const additionalMap = await this.driveFileEntityService.packManyByIdsMap(missingIds);
			for (const [k, v] of additionalMap) {
				packedFiles.set(k, v);
			}
		}
		return fileIds.map(id => packedFiles.get(id)).filter(isNotNull);
	}

	/**
	 * `note`をpackする。
	 *
	 * @param src              `note`もしくはそのID。
	 * @param me               閲覧者を指定するID。
	 * @param options.detail   `true`だった場合、`reply`や`renote`が含まれるようになる。`reply`は再帰的には解決されないが、`renote`は解決される。このような状況は、引用リノートをさらに引用した場合に発生する。
	 * @param options.skipHide 閲覧者の可視性に基づくhideを行うかどうか
	 * @param options._hint_
	 * @returns
	 */
	@bindThis
	public async pack(
		src: note['id'] | note,
		me?: { id: user['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
			_hint_?: {
				myReactions: Map<note['id'], note_reaction | null>;
				packedFiles: Map<note['fileIds'][number], z.infer<typeof DriveFileSchema> | null>;
			};
		},
	): Promise<z.infer<typeof NoteSchema>> {
		const opts = {
			detail: true,
			skipHide: false,
			...options,
		};

		const meId = me ? me.id : null;
		const note = await this.prismaService.client.note.findUniqueOrThrow({
			where: { id: typeof src === 'string' ? src : src.id },
			include: { user: true },
		});
		const host = note.userHost;

		let text = note.text;

		if (note.name && (note.url ?? note.uri)) {
			text = `【${note.name}】\n${(note.text ?? '').trim()}\n\n${note.url ?? note.uri}`;
		}

		const channel = note.channelId
			? await this.prismaService.client.channel.findUnique({ where: { id: note.channelId } })
			: null;

		const reactionEmojiNames = Object.keys(NoteReactionsSchema.optional().parse(note.reactions) ?? {})
			.filter(x => x.startsWith(':') && x.includes('@') && !x.includes('@.')) // リモートのカスタム絵文字のみ
			.map(x => this.reactionService.decodeReaction(x).reaction.replaceAll(':', ''));
		const packedFiles = options?._hint_?.packedFiles;

		const getDetail = (async (): Promise<Record<string, never> | { reply: z.infer<typeof NoteSchema> | undefined; renote: z.infer<typeof NoteSchema> | undefined; poll: Poll | undefined; myReaction?: unknown }> => {
			if (!opts.detail) return {};

			const result = await awaitAll({
				reply: () =>
					note.replyId
						? this.pack(note.replyId, me, { detail: false, _hint_: options?._hint_ })
						: Promise.resolve(undefined),
				renote: () =>
					note.renoteId
						? this.pack(note.renoteId, me, { detail: true, _hint_: options?._hint_ })
						: Promise.resolve(undefined),
				poll: () =>
					note.hasPoll
						? this.populatePoll(note, meId)
						: Promise.resolve(undefined),
				myReaction: () =>
					meId
						? this.populateMyReaction(note, meId, options?._hint_)
						: Promise.resolve(undefined),
			});

			return {
				reply: result.reply,
				renote: result.renote,
				poll: result.poll,
				...(result.myReaction != null ? { myReaction: result.myReaction } : {}),
			};
		});

		const result = await awaitAll({
			user: () =>
				this.userEntityService.packLite(note.user),
			reactionEmojis: () =>
				this.customEmojiService.populateEmojis(reactionEmojiNames, host),
			emojis: () =>
				host != null
					? this.customEmojiService.populateEmojis(note.emojis, host)
					: Promise.resolve(undefined),
			files: () =>
				packedFiles != null
					? Promise.resolve(this.packAttachedFiles(note.fileIds, packedFiles))
					: this.driveFileEntityService.packManyByIds(note.fileIds),
			detail: getDetail,
		});

		const packed = {
			id: note.id,
			createdAt: note.createdAt.toISOString(),
			userId: note.userId,
			user: result.user,
			text: text,
			cw: note.cw,
			visibility: note.visibility,
			localOnly: note.localOnly,
			reactionAcceptance: note.reactionAcceptance,
			visibleUserIds: note.visibility === 'specified' ? note.visibleUserIds : undefined,
			renoteCount: note.renoteCount,
			repliesCount: note.repliesCount,
			reactions: this.reactionService.convertLegacyReactions(z.record(z.string(), z.number()).optional().parse(note.reactions) ?? {}),
			reactionEmojis: result.reactionEmojis,
			emojis: result.emojis,
			tags: note.tags.length > 0 ? note.tags : undefined,
			fileIds: note.fileIds,
			files: result.files,
			replyId: note.replyId,
			renoteId: note.renoteId,
			channelId: note.channelId ?? undefined,
			channel: channel ? {
				id: channel.id,
				name: channel.name,
				color: channel.color,
			} : undefined,
			mentions: note.mentions.length > 0 ? note.mentions : undefined,
			uri: note.uri ?? undefined,
			url: note.url ?? undefined,
			...result.detail,
		};

		if (packed.user.isCat && packed.text) {
			const tokens = packed.text ? mfm.parse(packed.text) : [];
			for (const node of tokens) {
				nyaizeNode(node);
			}
			packed.text = mfm.toString(tokens);
		}

		if (!opts.skipHide) {
			await this.hideNote(packed, meId);
		}

		return packed;
	}

	/**
	 * 複数の`note`をまとめてpackする。
	 *
	 * @param notes `note`の配列（IDではない）。`renoteId`や`replyId`の解決は行われない。
	 * @param me
	 * @param options
	 * @returns
	 */
	@bindThis
	public async packMany(
		notes: (note & { renote?: note | null; reply?: note | null })[],
		me?: { id: user['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
		},
	): Promise<z.infer<typeof NoteSchema>[]> {
		if (notes.length === 0) return [];

		const meId = me ? me.id : null;

		/** `_hint_.myReactions`として渡すためのもの */
		const myReactionsMap = new Map<note['id'], note_reaction | null>();
		if (meId) {
			const renoteIds = notes.map(n => n.renoteId).filter(isNotNull);
			// パフォーマンスのためノートが作成されてから1秒以上経っていない場合はリアクションを取得しない
			const targets = [...notes.filter(n => n.createdAt.getTime() + 1000 < Date.now()).map(n => n.id), ...renoteIds];

			/** データベースからまとめて取得されたリアクション情報 */
			const myReactions = await this.prismaService.client.note_reaction.findMany({
				where: {
					userId: meId,
					noteId: { in: targets },
				},
			});

			// `myReactions`を`noteId`をもとにグループ化した上で`myReactionsMap`にセット
			for (const target of targets) {
				myReactionsMap.set(target, myReactions.find(reaction => reaction.noteId === target) ?? null);
			}
		}

		await this.customEmojiService.prefetchEmojis(this.aggregateNoteEmojis(notes));

		// TODO: renoteIdやreplyIdを解決する

		const fileIds = notes.map(n => [n.fileIds, n.renote?.fileIds, n.reply?.fileIds]).flat(2).filter(isNotNull);
		const packedFiles = new Map(
			fileIds.length > 0
				? await this.driveFileEntityService.packManyByIdsMap(fileIds)
				: [],
		);

		return await Promise.all(
			notes.map(n => this.pack(n, me, { ...options, _hint_: { myReactions: myReactionsMap, packedFiles } })),
		);
	}

	private parseNoteEmojis(emojis: string[], host: string | null): ({ name: null; host: null; } | { name: string | undefined; host: string | null; })[] {
		return emojis.map(e => this.customEmojiService.parseEmojiStr(e, host));
	};

	/**
	 * 引数として渡された複数の`note`に関連したすべての絵文字を集計する。
	 * その`note`で使われている絵文字のみならず、`user`や`renote`や`renote.user`や`reactions`からも集計する。
	 * `reply`からの集計には対応していない。
	 *
	 * @param notes
	 * @returns
	 */
	@bindThis
	public aggregateNoteEmojis(notes: (note & { renote?: (note & { user?: user }) | null; user?: user })[]): { name: string; host: string; }[] {
		let emojis: ({ name: null; host: null; } | { name: string | undefined; host: string | null; })[] = [];

		for (const note of notes) {
			emojis = emojis.concat(this.parseNoteEmojis(note.emojis, note.userHost));
			if (note.user) {
				emojis = emojis.concat(this.parseNoteEmojis(note.user.emojis, note.userHost));
			}
			if (note.renote != null) {
				emojis = emojis.concat(this.parseNoteEmojis(note.renote.emojis, note.renote.userHost));
			}
			if (note.renote?.user != null) {
				emojis = emojis.concat(this.parseNoteEmojis(note.renote.user.emojis, note.renote.userHost));
			}

			// `note.reactions`で使われている絵文字を集計
			const reactions = NoteReactionsSchema.parse(note.reactions);
			const customReactions = Object.keys(reactions)
				.map(x => this.reactionService.decodeReaction(x))
				.map(({ name, host }) => ({ name, host }))
				.filter((x): x is { name: string; host: string | null } => x.name !== undefined && x.host !== undefined);
			emojis = emojis.concat(customReactions);
		}

		return emojis.filter((x): x is { name: string; host: string; } => x.name != null && x.host != null);
	}

	/**
	 * `userId`で指定したユーザーの、`renoteId`で指定した`note`の`renote`がいくつあるか数える。
	 *
	 * @param userId
	 * @param renoteId
	 * @param excludeNoteId カウントしない`renote`のID。
	 * @returns
	 */
	@bindThis
	public async countSameRenotes(userId: string, renoteId: string, excludeNoteId: string | undefined): Promise<number> {
		return await this.prismaService.client.note.count({
			where: {
				userId: userId,
				renoteId: renoteId,
				id: { not: excludeNoteId },
			}
		});
	}
}
