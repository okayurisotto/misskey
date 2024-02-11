import { Injectable } from '@nestjs/common';
import * as mfm from 'mfm-js';
import { z } from 'zod';
import { nyaize } from '@/misc/nyaize.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { isNotNull } from '@/misc/is-not-null.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import type { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ReactionDecodeService } from '../ReactionDecodeService.js';
import { LegacyReactionConvertService } from '../LegacyReactionConvertService.js';
import { CustomEmojiPopulateService } from '../CustomEmojiPopulateService.js';
import { UserEntityPackLiteService } from './UserEntityPackLiteService.js';
import { DriveFileEntityPackService } from './DriveFileEntityPackService.js';
import type { Note, NoteReaction, user } from '@prisma/client';

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
export class NoteEntityPackService {
	constructor(
		private readonly customEmojiPopulateService: CustomEmojiPopulateService,
		private readonly driveFileEntityPackService: DriveFileEntityPackService,
		private readonly legacyReactionConvertService: LegacyReactionConvertService,
		private readonly prismaService: PrismaService,
		private readonly reactionDecodeService: ReactionDecodeService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	/**
	 * packされたnoteを閲覧者からの可視性に基づいて適切に隠す。
	 *
	 * @param packedNote packされたnote。このメソッドの実行によってmutableに書き換えられる。
	 * @param meId       閲覧者を指定するID。
	 * @returns          `mutable`なメソッドなため返り値はなし。
	 */
	private async hideNote(
		packedNote: z.infer<typeof NoteSchema>,
		meId: user['id'] | null,
	): Promise<void> {
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
				const specified =
					packedNote.visibleUserIds?.some((id) => meId === id) ?? false;

				hide = !specified;
			}
		}

		// `visibility`が`'followers'` && 自分が投稿者のフォロワーでない => 非表示
		if (packedNote.visibility === 'followers') {
			if (meId == null) {
				hide = true;
			} else if (meId === packedNote.userId) {
				hide = false;
			} else if (packedNote.reply && meId === packedNote.reply.userId) {
				// 自分の投稿に対するリプライだった場合は表示する
				hide = false;
			} else if (
				packedNote.mentions &&
				packedNote.mentions.some((id) => meId === id)
			) {
				// 自分へのメンションが含まれる場合は表示する
				hide = false;
			} else {
				/** 自分が投稿者のフォロワーかどうか */
				const isFollowing =
					(await this.prismaService.client.following.count({
						where: {
							followeeId: packedNote.userId,
							followerId: meId,
						},
						take: 1,
					})) > 0;

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
	private async populatePoll(
		note: Note,
		meId: user['id'] | null,
	): Promise<Poll> {
		const poll = await this.prismaService.client.poll.findUniqueOrThrow({
			where: { noteId: note.id },
		});
		const choices = poll.choices.map((c) => ({
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

				const myChoices = votes.map((v) => v.choice);
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
	private async populateMyReaction(
		note: Note,
		meId: string,
		_hint_?: {
			myReactions: Map<string, NoteReaction | null>;
		},
	): Promise<string | undefined> {
		if (_hint_?.myReactions) {
			const reaction = _hint_.myReactions.get(note.id);
			if (reaction) {
				return this.legacyReactionConvertService.convert(reaction.reaction);
			} else if (reaction === null) {
				return undefined;
			}
			// 実装上抜けがあるだけかもしれないので、「ヒントに含まれていなかったら`return`」のようにはしない
		}

		// パフォーマンスのためノートが作成されてから1秒以上経っていない場合はリアクションを取得しない
		if (note.createdAt.getTime() + 1000 > Date.now()) {
			return undefined;
		}

		const reaction = await this.prismaService.client.noteReaction.findUnique({
			where: {
				userId_noteId: {
					userId: meId,
					noteId: note.id,
				},
			},
		});

		if (reaction) {
			return this.legacyReactionConvertService.convert(reaction.reaction);
		}

		return undefined;
	}

	/**
	 * `note`にattachされた`file`をpackする。
	 *
	 * @param fileIds     `note.fileIds`のこと。
	 * @param packedFiles あらかじめpackされた`file`の`Map`。ここにないものはあとから取得され、追加される。
	 * @returns           packされた`file`。取得できなかった`file`に関しては除かれるため、`fileIds`と要素数が合わないこともなくはないはず。
	 */
	private async packAttachedFiles(
		fileIds: Note['fileIds'],
		packedFiles: Map<
			Note['fileIds'][number],
			z.infer<typeof DriveFileSchema> | null
		>,
	): Promise<z.infer<typeof DriveFileSchema>[]> {
		const missingIds = [];
		for (const id of fileIds) {
			if (!packedFiles.has(id)) missingIds.push(id);
		}
		if (missingIds.length > 0) {
			const additionalMap =
				await this.driveFileEntityPackService.packManyByIdsMap(missingIds);
			for (const [k, v] of additionalMap) {
				packedFiles.set(k, v);
			}
		}
		return fileIds.map((id) => packedFiles.get(id)).filter(isNotNull);
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
	public async pack(
		src: Note['id'] | Note,
		me?: { id: user['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
			_hint_?: {
				myReactions: Map<string, NoteReaction | null>;
				packedFiles: Map<
					Note['fileIds'][number],
					z.infer<typeof DriveFileSchema> | null
				>;
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
			text = `【${note.name}】\n${(note.text ?? '').trim()}\n\n${
				note.url ?? note.uri
			}`;
		}

		const channel = note.channelId
			? await this.prismaService.client.channel.findUnique({
					where: { id: note.channelId },
			  })
			: null;

		const reactionEmojiNames = Object.keys(
			NoteReactionsSchema.optional().parse(note.reactions) ?? {},
		)
			.filter((x) => x.startsWith(':') && x.includes('@') && !x.includes('@.')) // リモートのカスタム絵文字のみ
			.map((x) => {
				return this.reactionDecodeService
					.decode(x)
					.reaction.replaceAll(':', '');
			});
		const packedFiles = options?._hint_?.packedFiles;

		const getDetail = async (): Promise<
			| Record<string, never>
			| {
					reply: z.infer<typeof NoteSchema> | undefined;
					renote: z.infer<typeof NoteSchema> | undefined;
					poll: Poll | undefined;
					myReaction?: unknown;
			  }
		> => {
			if (!opts.detail) return {};

			const result = await awaitAll({
				reply: () =>
					note.replyId
						? this.pack(note.replyId, me, {
								detail: false,
								_hint_: options?._hint_,
						  })
						: Promise.resolve(undefined),
				renote: () =>
					note.renoteId
						? this.pack(note.renoteId, me, {
								detail: true,
								_hint_: options?._hint_,
						  })
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
		};

		const result = await awaitAll({
			user: () => this.userEntityPackLiteService.packLite(note.user),
			reactionEmojis: () =>
				this.customEmojiPopulateService.populate(reactionEmojiNames, host),
			emojis: () =>
				host != null
					? this.customEmojiPopulateService.populate(note.emojis, host)
					: Promise.resolve(undefined),
			files: () =>
				packedFiles != null
					? Promise.resolve(this.packAttachedFiles(note.fileIds, packedFiles))
					: this.driveFileEntityPackService.packManyByIds(note.fileIds),
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
			visibleUserIds:
				note.visibility === 'specified' ? note.visibleUserIds : undefined,
			renoteCount: note.renoteCount,
			repliesCount: note.repliesCount,
			reactions: this.legacyReactionConvertService.convertAll(
				z.record(z.string(), z.number()).optional().parse(note.reactions) ?? {},
			),
			reactionEmojis: result.reactionEmojis,
			emojis: result.emojis,
			tags: note.tags.length > 0 ? note.tags : undefined,
			fileIds: note.fileIds,
			files: result.files,
			replyId: note.replyId,
			renoteId: note.renoteId,
			channelId: note.channelId ?? undefined,
			channel: channel
				? {
						id: channel.id,
						name: channel.name,
						color: channel.color,
				  }
				: undefined,
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
	 * @param notes
	 * @param me
	 * @param options
	 * @returns
	 */
	public async packMany(
		notes: (Note & { renote?: Note | null; reply?: Note | null })[],
		me?: { id: user['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
		},
	): Promise<z.infer<typeof NoteSchema>[]> {
		if (notes.length === 0) return [];

		const meId = me ? me.id : null;

		/** `_hint_.myReactions`として渡すためのもの */
		const myReactionsMap = new Map<string, NoteReaction | null>();
		if (meId) {
			const renoteIds = notes.map((n) => n.renoteId).filter(isNotNull);
			// パフォーマンスのためノートが作成されてから1秒以上経っていない場合はリアクションを取得しない
			const targets = [
				...notes
					.filter((n) => n.createdAt.getTime() + 1000 < Date.now())
					.map((n) => n.id),
				...renoteIds,
			];

			/** データベースからまとめて取得されたリアクション情報 */
			const myReactions =
				await this.prismaService.client.noteReaction.findMany({
					where: {
						userId: meId,
						noteId: { in: targets },
					},
				});

			// `myReactions`を`noteId`をもとにグループ化した上で`myReactionsMap`にセット
			for (const target of targets) {
				myReactionsMap.set(
					target,
					myReactions.find((reaction) => reaction.noteId === target) ?? null,
				);
			}
		}

		// TODO: renoteIdやreplyIdを解決する

		const fileIds = notes
			.map((n) => [n.fileIds, n.renote?.fileIds, n.reply?.fileIds])
			.flat(2)
			.filter(isNotNull);
		const packedFiles = new Map(
			fileIds.length > 0
				? await this.driveFileEntityPackService.packManyByIdsMap(fileIds)
				: [],
		);

		return await Promise.all(
			notes.map((n) =>
				this.pack(n, me, {
					...options,
					_hint_: { myReactions: myReactionsMap, packedFiles },
				}),
			),
		);
	}
}
