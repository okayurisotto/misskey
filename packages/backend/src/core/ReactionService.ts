import { Injectable } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library.js';
import { z } from 'zod';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { RemoteUser, User } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';
import { IdService } from '@/core/IdService.js';
import type { NoteReaction } from '@/models/entities/NoteReaction.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { NotificationService } from '@/core/NotificationService.js';
import PerUserReactionsChart from '@/core/chart/charts/per-user-reactions.js';
import { emojiRegex } from '@/misc/emoji-regex.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { MetaService } from '@/core/MetaService.js';
import { bindThis } from '@/decorators.js';
import { UtilityService } from '@/core/UtilityService.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { RoleService } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { note, note_reaction } from '@prisma/client';

const FALLBACK = '❤';

const legacies: Record<string, string> = {
	'like': '👍',
	'love': '❤', // ここに記述する場合は異体字セレクタを入れない
	'laugh': '😆',
	'hmm': '🤔',
	'surprise': '😮',
	'congrats': '🎉',
	'angry': '💢',
	'confused': '😥',
	'rip': '😇',
	'pudding': '🍮',
	'star': '⭐',
};

type DecodedReaction = {
	/**
	 * リアクション名 (Unicode Emoji or ':name@hostname' or ':name@.')
	 */
	reaction: string;

	/**
	 * name (カスタム絵文字の場合name, Emojiクエリに使う)
	 */
	name?: string;

	/**
	 * host (カスタム絵文字の場合host, Emojiクエリに使う)
	 */
	host?: string | null;
};

const isCustomEmojiRegexp = /^:([\w+-]+)(?:@\.)?:$/;
const decodeCustomEmojiRegexp = /^:([\w+-]+)(?:@([\w.-]+))?:$/;

@Injectable()
export class ReactionService {
	constructor(
		private readonly utilityService: UtilityService,
		private readonly metaService: MetaService,
		private readonly customEmojiService: CustomEmojiService,
		private readonly roleService: RoleService,
		private readonly userEntityService: UserEntityService,
		private readonly noteEntityService: NoteEntityService,
		private readonly userBlockingService: UserBlockingService,
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly apRendererService: ApRendererService,
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly notificationService: NotificationService,
		private readonly perUserReactionsChart: PerUserReactionsChart,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async create(user: { id: User['id']; host: User['host']; isBot: User['isBot'] }, note: note, _reaction?: string | null) {
		// Check blocking
		if (note.userId !== user.id) {
			const blocked = await this.userBlockingService.checkBlocked(note.userId, user.id);
			if (blocked) {
				throw new IdentifiableError('e70412a4-7197-4726-8e74-f3e0deb92aa7');
			}
		}

		// check visibility
		if (!await this.noteEntityService.isVisibleForMe(note, user.id)) {
			throw new IdentifiableError('68e9d2d1-48bf-42c2-b90a-b20e09fd3d48', 'Note not accessible for you.');
		}

		let reaction = _reaction ?? FALLBACK;

		if (note.reactionAcceptance === 'likeOnly' || ((note.reactionAcceptance === 'likeOnlyForRemote' || note.reactionAcceptance === 'nonSensitiveOnlyForLocalLikeOnlyForRemote') && (user.host != null))) {
			reaction = '❤️';
		} else if (_reaction) {
			const custom = reaction.match(isCustomEmojiRegexp);
			if (custom) {
				const reacterHost = this.utilityService.toPunyNullable(user.host);

				const name = custom[1];
				const emoji = reacterHost == null
					? (await this.customEmojiService.localEmojisCache.fetch()).get(name)
					: await this.prismaService.client.emoji.findUnique({
						where: {
							name_host: {
								host: reacterHost,
								name,
							},
						},
					});

				if (emoji) {
					if (emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.length === 0 || (await this.roleService.getUserRoles(user.id)).some(r => emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.includes(r.id))) {
						reaction = reacterHost ? `:${name}@${reacterHost}:` : `:${name}:`;

						// センシティブ
						if ((note.reactionAcceptance === 'nonSensitiveOnly') && emoji.isSensitive) {
							reaction = FALLBACK;
						}
					} else {
						// リアクションとして使う権限がない
						reaction = FALLBACK;
					}
				} else {
					reaction = FALLBACK;
				}
			} else {
				reaction = this.normalize(reaction ?? null);
			}
		}

		const record: note_reaction = {
			id: this.idService.genId(),
			createdAt: new Date(),
			noteId: note.id,
			userId: user.id,
			reaction,
		};

		// Create reaction
		try {
			await this.prismaService.client.note_reaction.create({ data: record });
		} catch (e: any) {
			if (e instanceof PrismaClientKnownRequestError) {
				if (e.code === 'P2002') {
					const exists = await this.prismaService.client.note_reaction.findUniqueOrThrow({
						where: {
							userId_noteId: {
								noteId: note.id,
								userId: user.id,
							},
						},
					});

					if (exists.reaction !== reaction) {
						// 別のリアクションがすでにされていたら置き換える
						await this.delete(user, note);
						await this.prismaService.client.note_reaction.create({ data: record });
					} else {
						// 同じリアクションがすでにされていたらエラー
						throw new IdentifiableError('51c42bb4-931a-456b-bff7-e5a8a70dd298');
					}
				} else {
					throw e;
				}
			} else {
				throw e;
			}
		}

		// Increment reactions count
		await this.prismaService.client.$transaction(async (client) => {
			const data = await client.note.findUniqueOrThrow({ where: { id: note.id } });

			const reactions = z.record(z.string(), z.number().int()).parse(data.reactions);

			const count = (() => {
				if (reaction in reactions) return reactions[reaction] + 1;
				return 1;
			})();

			await client.note.update({
				where: { id: note.id },
				data: {
					reactions: {
						...reactions,
						[reaction]: count,
					},
					...(user.isBot ? {} : { score: { increment: 1 } }),
				},
			});
		});

		const meta = await this.metaService.fetch();

		if (meta.enableChartsForRemoteUser || (user.host == null)) {
			this.perUserReactionsChart.update(user, note);
		}

		// カスタム絵文字リアクションだったら絵文字情報も送る
		const decodedReaction = this.decodeReaction(reaction);

		const customEmoji = decodedReaction.name == null ? null : decodedReaction.host == null
			? (await this.customEmojiService.localEmojisCache.fetch()).get(decodedReaction.name)
			: await this.prismaService.client.emoji.findUnique({
					where: {
						name_host: {
							name: decodedReaction.name,
							host: decodedReaction.host,
						},
					},
				});

		this.globalEventService.publishNoteStream(note.id, 'reacted', {
			reaction: decodedReaction.reaction,
			emoji: customEmoji != null ? {
				name: customEmoji.host ? `${customEmoji.name}@${customEmoji.host}` : `${customEmoji.name}@.`,
				// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
				url: customEmoji.publicUrl || customEmoji.originalUrl,
			} : null,
			userId: user.id,
		});

		// リアクションされたユーザーがローカルユーザーなら通知を作成
		if (note.userHost === null) {
			this.notificationService.createNotification(note.userId, 'reaction', {
				notifierId: user.id,
				noteId: note.id,
				reaction: reaction,
			});
		}

		//#region 配信
		if (this.userEntityService.isLocalUser(user) && !note.localOnly) {
			const content = this.apRendererService.addContext(await this.apRendererService.renderLike(record, note));
			const dm = this.apDeliverManagerService.createDeliverManager(user, content);
			if (note.userHost !== null) {
				const reactee = await this.prismaService.client.user.findUnique({ where: { id: note.userId } });
				dm.addDirectRecipe(reactee as RemoteUser);
			}

			if (['public', 'home', 'followers'].includes(note.visibility)) {
				dm.addFollowersRecipe();
			} else if (note.visibility === 'specified') {
				const visibleUsers = await Promise.all(
					note.visibleUserIds.map(id => this.prismaService.client.user.findUnique({ where: { id } })),
				);
				for (const u of visibleUsers.filter(u => u && this.userEntityService.isRemoteUser(u))) {
					dm.addDirectRecipe(u as RemoteUser);
				}
			}

			dm.execute();
		}
		//#endregion
	}

	@bindThis
	public async delete(user: { id: User['id']; host: User['host']; isBot: User['isBot']; }, note: note) {
		// if already unreacted
		const exist = await this.prismaService.client.note_reaction.findUnique({
			where: {
				userId_noteId: {
					noteId: note.id,
					userId: user.id,
				},
			},
		});

		if (exist == null) {
			throw new IdentifiableError('60527ec9-b4cb-4a88-a6bd-32d3ad26817d', 'not reacted');
		}

		// Delete reaction
		await this.prismaService.client.note_reaction.delete({ where: { id: exist.id } }).catch(() => {
			throw new IdentifiableError('60527ec9-b4cb-4a88-a6bd-32d3ad26817d', 'not reacted');
		})

		// Decrement reactions count
		await this.prismaService.client.$transaction(async (client) => {
			const data = await client.note.findUniqueOrThrow({ where: { id: note.id } });

			const reactions = z.record(z.string(), z.number().int()).parse(data.reactions);

			await client.note.update({
				where: { id: note.id },
				data: {
					reactions: Object.fromEntries(Object.entries(reactions).map(([k, v]) => {
						if (k !== exist.reaction) return [k, v];
						return [k, v - 1];
					})),
				},
			});
		});

		if (!user.isBot) {
			await this.prismaService.client.note.update({
				where: { id: note.id },
				data: { score: { decrement: 1 } },
			});
		}

		this.globalEventService.publishNoteStream(note.id, 'unreacted', {
			reaction: this.decodeReaction(exist.reaction).reaction,
			userId: user.id,
		});

		//#region 配信
		if (this.userEntityService.isLocalUser(user) && !note.localOnly) {
			const content = this.apRendererService.addContext(this.apRendererService.renderUndo(await this.apRendererService.renderLike(exist, note), user));
			const dm = this.apDeliverManagerService.createDeliverManager(user, content);
			if (note.userHost !== null) {
				const reactee = await this.prismaService.client.user.findUnique({ where: { id: note.userId } });
				dm.addDirectRecipe(reactee as RemoteUser);
			}
			dm.addFollowersRecipe();
			await dm.execute();
		}
		//#endregion
	}

	@bindThis
	public convertLegacyReactions(reactions: Record<string, number>) {
		const _reactions = {} as Record<string, number>;

		for (const reaction of Object.keys(reactions)) {
			if (reactions[reaction] <= 0) continue;

			if (Object.keys(legacies).includes(reaction)) {
				if (_reactions[legacies[reaction]]) {
					_reactions[legacies[reaction]] += reactions[reaction];
				} else {
					_reactions[legacies[reaction]] = reactions[reaction];
				}
			} else {
				if (_reactions[reaction]) {
					_reactions[reaction] += reactions[reaction];
				} else {
					_reactions[reaction] = reactions[reaction];
				}
			}
		}

		const _reactions2 = {} as Record<string, number>;

		for (const reaction of Object.keys(_reactions)) {
			_reactions2[this.decodeReaction(reaction).reaction] = _reactions[reaction];
		}

		return _reactions2;
	}

	@bindThis
	public normalize(reaction: string | null): string {
		if (reaction == null) return FALLBACK;

		// 文字列タイプのリアクションを絵文字に変換
		if (Object.keys(legacies).includes(reaction)) return legacies[reaction];

		// Unicode絵文字
		const match = emojiRegex.exec(reaction);
		if (match) {
			// 合字を含む1つの絵文字
			const unicode = match[0];

			// 異体字セレクタ除去
			return unicode.match('\u200d') ? unicode : unicode.replace(/\ufe0f/g, '');
		}

		return FALLBACK;
	}

	@bindThis
	public decodeReaction(str: string): DecodedReaction {
		const custom = str.match(decodeCustomEmojiRegexp);

		if (custom) {
			const name = custom[1];
			const host = custom[2] ?? null;

			return {
				reaction: `:${name}@${host ?? '.'}:`,	// ローカル分は@以降を省略するのではなく.にする
				name,
				host,
			};
		}

		return {
			reaction: str,
			name: undefined,
			host: undefined,
		};
	}

	@bindThis
	public convertLegacyReaction(reaction: string): string {
		reaction = this.decodeReaction(reaction).reaction;
		if (Object.keys(legacies).includes(reaction)) return legacies[reaction];
		return reaction;
	}
}
