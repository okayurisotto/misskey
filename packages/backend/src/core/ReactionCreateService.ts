import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
	Prisma,
	type Note,
	type NoteReaction,
	type user,
} from '@prisma/client';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { RemoteUser } from '@/models/entities/User.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { NotificationService } from '@/core/NotificationService.js';
import PerUserReactionsChart from '@/core/chart/charts/per-user-reactions.js';
import { emojiRegex } from '@/misc/emoji-regex.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { MetaService } from '@/core/MetaService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { RoleService } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserBlockingCheckService } from './UserBlockingCheckService.js';
import { CustomEmojiLocalCacheService } from './CustomEmojiLocalCacheService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import { ReactionDecodeService } from './ReactionDecodeService.js';
import { ReactionDeleteService } from './ReactionDeleteService.js';
import { NoteVisibilityService } from './entities/NoteVisibilityService.js';

const FALLBACK = '❤';

const legacies: Record<string, string> = {
	like: '👍',
	love: '❤', // ここに記述する場合は異体字セレクタを入れない
	laugh: '😆',
	hmm: '🤔',
	surprise: '😮',
	congrats: '🎉',
	angry: '💢',
	confused: '😥',
	rip: '😇',
	pudding: '🍮',
	star: '⭐',
};

const isCustomEmojiRegexp = /^:([\w+-]+)(?:@\.)?:$/;

@Injectable()
export class ReactionCreateService {
	constructor(
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly apRendererService: ApRendererService,
		private readonly customEmojiLocalCacheService: CustomEmojiLocalCacheService,
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly metaService: MetaService,
		private readonly noteVisibilityService: NoteVisibilityService,
		private readonly notificationService: NotificationService,
		private readonly perUserReactionsChart: PerUserReactionsChart,
		private readonly prismaService: PrismaService,
		private readonly reactionDecodeService: ReactionDecodeService,
		private readonly reactionDeleteService: ReactionDeleteService,
		private readonly roleService: RoleService,
		private readonly userBlockingCheckService: UserBlockingCheckService,
		private readonly userEntityUtilService: UserEntityUtilService,
		private readonly utilityService: UtilityService,
	) {}

	public async create(
		user: { id: user['id']; host: user['host']; isBot: user['isBot'] },
		note: Note,
		_reaction?: string | null,
	): Promise<void> {
		// Check blocking
		if (note.userId !== user.id) {
			const blocked = await this.userBlockingCheckService.check(
				note.userId,
				user.id,
			);
			if (blocked) {
				throw new IdentifiableError('e70412a4-7197-4726-8e74-f3e0deb92aa7');
			}
		}

		// check visibility
		if (!(await this.noteVisibilityService.isVisibleForMe(note, user.id))) {
			throw new IdentifiableError(
				'68e9d2d1-48bf-42c2-b90a-b20e09fd3d48',
				'Note not accessible for you.',
			);
		}

		let reaction = _reaction ?? FALLBACK;

		if (
			note.reactionAcceptance === 'likeOnly' ||
			((note.reactionAcceptance === 'likeOnlyForRemote' ||
				note.reactionAcceptance ===
					'nonSensitiveOnlyForLocalLikeOnlyForRemote') &&
				user.host != null)
		) {
			reaction = '❤️';
		} else if (_reaction) {
			const custom = reaction.match(isCustomEmojiRegexp);
			if (custom) {
				const reacterHost = this.utilityService.toPunyNullable(user.host);

				const name = custom[1];
				const emoji =
					reacterHost == null
						? (await this.customEmojiLocalCacheService.fetch()).get(name)
						: await this.prismaService.client.customEmoji.findUnique({
								where: { name_host: { host: reacterHost, name } },
						  });

				if (emoji) {
					if (
						emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.length === 0 ||
						(await this.roleService.getUserRoles(user.id)).some((r) =>
							emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.includes(r.id),
						)
					) {
						reaction = reacterHost ? `:${name}@${reacterHost}:` : `:${name}:`;

						// センシティブ
						if (
							note.reactionAcceptance === 'nonSensitiveOnly' &&
							emoji.isSensitive
						) {
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

		const record: NoteReaction = {
			id: this.idService.genId(),
			createdAt: new Date(),
			noteId: note.id,
			userId: user.id,
			reaction,
		};

		// Create reaction
		try {
			await this.prismaService.client.noteReaction.create({ data: record });
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2002') {
					const exists =
						await this.prismaService.client.noteReaction.findUniqueOrThrow({
							where: { userId_noteId: { noteId: note.id, userId: user.id } },
						});

					if (exists.reaction !== reaction) {
						// 別のリアクションがすでにされていたら置き換える
						await this.reactionDeleteService.delete(user, note);
						await this.prismaService.client.noteReaction.create({
							data: record,
						});
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
			const data = await client.note.findUniqueOrThrow({
				where: { id: note.id },
			});

			const reactions = z
				.record(z.string(), z.number().int())
				.parse(data.reactions);

			const count = ((): number => {
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

		if (meta.enableChartsForRemoteUser || user.host == null) {
			this.perUserReactionsChart.update(user, note);
		}

		// カスタム絵文字リアクションだったら絵文字情報も送る
		const decodedReaction = this.reactionDecodeService.decode(reaction);

		const customEmoji =
			decodedReaction.name == null
				? null
				: decodedReaction.host == null
				? (await this.customEmojiLocalCacheService.fetch()).get(
						decodedReaction.name,
				  )
				: await this.prismaService.client.customEmoji.findUnique({
						where: {
							name_host: {
								name: decodedReaction.name,
								host: decodedReaction.host,
							},
						},
				  });

		this.globalEventService.publishNoteStream(note.id, 'reacted', {
			reaction: decodedReaction.reaction,
			emoji:
				customEmoji != null
					? {
							name: customEmoji.host
								? `${customEmoji.name}@${customEmoji.host}`
								: `${customEmoji.name}@.`,
							// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
							url: customEmoji.publicUrl || customEmoji.originalUrl,
					  }
					: null,
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
		if (this.userEntityUtilService.isLocalUser(user) && !note.localOnly) {
			const content = this.apRendererService.addContext(
				await this.apRendererService.renderLike(record, note),
			);
			const dm = this.apDeliverManagerService.createDeliverManager(
				user,
				content,
			);
			if (note.userHost !== null) {
				const reactee = await this.prismaService.client.user.findUnique({
					where: { id: note.userId },
				});
				dm.addDirectRecipe(reactee as RemoteUser);
			}

			if (['public', 'home', 'followers'].includes(note.visibility)) {
				dm.addFollowersRecipe();
			} else if (note.visibility === 'specified') {
				const visibleUsers = await Promise.all(
					note.visibleUserIds.map((id) =>
						this.prismaService.client.user.findUnique({ where: { id } }),
					),
				);
				for (const u of visibleUsers.filter(
					(u) => u && this.userEntityUtilService.isRemoteUser(u),
				)) {
					dm.addDirectRecipe(u as RemoteUser);
				}
			}

			dm.execute();
		}
		//#endregion
	}

	private normalize(reaction: string | null): string {
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
}
