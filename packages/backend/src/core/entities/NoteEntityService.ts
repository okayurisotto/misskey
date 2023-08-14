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

	onModuleInit() {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.driveFileEntityService = this.moduleRef.get('DriveFileEntityService');
		this.customEmojiService = this.moduleRef.get('CustomEmojiService');
		this.reactionService = this.moduleRef.get('ReactionService');
	}

	@bindThis
	private async hideNote(packedNote: z.infer<typeof NoteSchema>, meId: user['id'] | null) {
		// TODO: isVisibleForMe を使うようにしても良さそう(型違うけど)
		let hide = false;

		// visibility が specified かつ自分が指定されていなかったら非表示
		if (packedNote.visibility === 'specified') {
			if (meId == null) {
				hide = true;
			} else if (meId === packedNote.userId) {
				hide = false;
			} else {
			// 指定されているかどうか
				const specified = packedNote.visibleUserIds!.some((id: any) => meId === id);

				if (specified) {
					hide = false;
				} else {
					hide = true;
				}
			}
		}

		// visibility が followers かつ自分が投稿者のフォロワーでなかったら非表示
		if (packedNote.visibility === 'followers') {
			if (meId == null) {
				hide = true;
			} else if (meId === packedNote.userId) {
				hide = false;
			} else if (packedNote.reply && (meId === packedNote.reply.userId)) {
				// 自分の投稿に対するリプライ
				hide = false;
			} else if (packedNote.mentions && packedNote.mentions.some(id => meId === id)) {
				// 自分へのメンション
				hide = false;
			} else {
				// フォロワーかどうか
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

	@bindThis
	private async populatePoll(note: note, meId: user['id'] | null) {
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

	@bindThis
	private async populateMyReaction(note: note, meId: user['id'], _hint_?: {
		myReactions: Map<note['id'], note_reaction | null>;
	}) {
		if (_hint_?.myReactions) {
			const reaction = _hint_.myReactions.get(note.id);
			if (reaction) {
				return this.reactionService.convertLegacyReaction(reaction.reaction);
			} else if (reaction === null) {
				return undefined;
			}
		// 実装上抜けがあるだけかもしれないので、「ヒントに含まれてなかったら(=undefinedなら)return」のようにはしない
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

	@bindThis
	public async isVisibleForMe(note: note, meId: user['id'] | null): Promise<boolean> {
		// This code must always be synchronized with the checks in generateVisibilityQuery.
		// visibility が specified かつ自分が指定されていなかったら非表示
		if (note.visibility === 'specified') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else {
				// 指定されているかどうか
				return note.visibleUserIds.some((id: any) => meId === id);
			}
		}

		// visibility が followers かつ自分が投稿者のフォロワーでなかったら非表示
		if (note.visibility === 'followers') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else if (meId === note.replyUserId) {
				// 自分の投稿に対するリプライ
				return true;
			} else if (note.mentions && note.mentions.some(id => meId === id)) {
				// 自分へのメンション
				return true;
			} else {
				// フォロワーかどうか
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

				/* If we know the following, everyhting is fine.

				But if we do not know the following, it might be that both the
				author of the note and the author of the like are remote users,
				in which case we can never know the following. Instead we have
				to assume that the users are following each other.
				*/
				return following > 0 || (note.userHost != null && user.host != null);
			}
		}

		return true;
	}

	@bindThis
	public async packAttachedFiles(fileIds: note['fileIds'], packedFiles: Map<note['fileIds'][number], z.infer<typeof DriveFileSchema> | null>): Promise<z.infer<typeof DriveFileSchema>[]> {
		const missingIds = [];
		for (const id of fileIds) {
			if (!packedFiles.has(id)) missingIds.push(id);
		}
		if (missingIds.length) {
			const additionalMap = await this.driveFileEntityService.packManyByIdsMap(missingIds);
			for (const [k, v] of additionalMap) {
				packedFiles.set(k, v);
			}
		}
		return fileIds.map(id => packedFiles.get(id)).filter(isNotNull);
	}

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
		const opts = Object.assign({
			detail: true,
			skipHide: false,
		}, options);

		const meId = me ? me.id : null;
		const note = typeof src === 'object'
			? src
			: await this.prismaService.client.note.findUniqueOrThrow({ where: { id: src } });
		const host = note.userHost;

		let text = note.text;

		if (note.name && (note.url ?? note.uri)) {
			text = `【${note.name}】\n${(note.text ?? '').trim()}\n\n${note.url ?? note.uri}`;
		}

		const channel = note.channelId
			? await this.prismaService.client.channel.findUnique({ where: { id: note.channelId } })
			: null;

		const reactionEmojiNames = Object.keys(z.record(z.string(), z.number()).optional().parse(note.reactions) ?? {})
			.filter(x => x.startsWith(':') && x.includes('@') && !x.includes('@.')) // リモートカスタム絵文字のみ
			.map(x => this.reactionService.decodeReaction(x).reaction.replaceAll(':', ''));
		const packedFiles = options?._hint_?.packedFiles;

		const getDetail = (async () => {
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
				this.userEntityService.pack(note.userId, me, { detail: false }),
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
			localOnly: note.localOnly ?? undefined,
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
			function nyaizeNode(node: mfm.MfmNode) {
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

	@bindThis
	public async packMany(
		notes: (note & { renote?: note | null; reply?: note | null })[],
		me?: { id: user['id'] } | null | undefined,
		options?: {
			detail?: boolean;
			skipHide?: boolean;
		},
	) {
		if (notes.length === 0) return [];

		const meId = me ? me.id : null;
		const myReactionsMap = new Map<note['id'], note_reaction | null>();
		if (meId) {
			const renoteIds = notes.filter(n => n.renoteId != null).map(n => n.renoteId!);
			// パフォーマンスのためノートが作成されてから1秒以上経っていない場合はリアクションを取得しない
			const targets = [...notes.filter(n => n.createdAt.getTime() + 1000 < Date.now()).map(n => n.id), ...renoteIds];
			const myReactions = await this.prismaService.client.note_reaction.findMany({
				where: {
					userId: meId,
					noteId: { in: targets },
				},
			});

			for (const target of targets) {
				myReactionsMap.set(target, myReactions.find(reaction => reaction.noteId === target) ?? null);
			}
		}

		await this.customEmojiService.prefetchEmojis(this.aggregateNoteEmojis(notes));
		// TODO: 本当は renote とか reply がないのに renoteId とか replyId があったらここで解決しておく
		const fileIds = notes.map(n => [n.fileIds, n.renote?.fileIds, n.reply?.fileIds]).flat(2).filter(isNotNull);
		const packedFiles = fileIds.length > 0 ? await this.driveFileEntityService.packManyByIdsMap(fileIds) : new Map();

		return await Promise.all(notes.map(n => this.pack(n, me, {
			...options,
			_hint_: {
				myReactions: myReactionsMap,
				packedFiles,
			},
		})));
	}

	@bindThis
	public aggregateNoteEmojis(notes: (note & { renote?: (note & { user?: user }) | null; user?: user })[]) {
		let emojis: { name: string | null; host: string | null; }[] = [];
		for (const note of notes) {
			emojis = emojis.concat(note.emojis
				.map(e => this.customEmojiService.parseEmojiStr(e, note.userHost)));
			if (note.renote) {
				emojis = emojis.concat(note.renote.emojis
					.map(e => this.customEmojiService.parseEmojiStr(e, note.renote!.userHost)));
				if (note.renote.user) {
					emojis = emojis.concat(note.renote.user.emojis
						.map(e => this.customEmojiService.parseEmojiStr(e, note.renote!.userHost)));
				}
			}
			const customReactions = Object.keys(z.record(z.string(), z.number()).parse(note.reactions)).map(x => this.reactionService.decodeReaction(x)).filter(x => x.name != null) as typeof emojis;
			emojis = emojis.concat(customReactions);
			if (note.user) {
				emojis = emojis.concat(note.user.emojis
					.map(e => this.customEmojiService.parseEmojiStr(e, note.userHost)));
			}
		}
		return emojis.filter(x => x.name != null && x.host != null) as { name: string; host: string; }[];
	}

	@bindThis
	public async countSameRenotes(userId: string, renoteId: string, excludeNoteId: string | undefined): Promise<number> {
		// 指定したユーザーの指定したノートのリノートがいくつあるか数える
		return await this.prismaService.client.note.count({
			where: {
				userId: userId,
				renoteId: renoteId,
				id: excludeNoteId,
			}
		});
	}
}
