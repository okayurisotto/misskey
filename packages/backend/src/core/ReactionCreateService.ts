import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
	Prisma,
	type Note,
	type NoteReaction,
	type User,
} from '@prisma/client';
import { isNotUndefined } from 'omick';
import { IdentifiableError } from '@/misc/identifiable-error.js';
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
import { FALLBACK_REACTION, LEGACY_REACTIONS } from '@/const.js';
import { UserBlockingCheckService } from './UserBlockingCheckService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import { ReactionDecodeService } from './ReactionDecodeService.js';
import { ReactionDeleteService } from './ReactionDeleteService.js';
import { NoteVisibilityService } from './entities/NoteVisibilityService.js';

const isCustomEmojiRegexp = /^:([\w+-]+)(?:@\.)?:$/;

@Injectable()
export class ReactionCreateService {
	constructor(
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly apRendererService: ApRendererService,
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
		user: Pick<User, 'id' | 'host' | 'isBot'>,
		note: Note,
		reaction_?: string | null,
	): Promise<void> {
		//#region Check blocking
		if (note.userId !== user.id) {
			const blocked = await this.userBlockingCheckService.check(
				note.userId,
				user.id,
			);
			if (blocked) {
				throw new IdentifiableError('e70412a4-7197-4726-8e74-f3e0deb92aa7');
			}
		}
		//#endregion

		//#region Check visibility
		if (!(await this.noteVisibilityService.isVisibleForMe(note, user.id))) {
			throw new IdentifiableError(
				'68e9d2d1-48bf-42c2-b90a-b20e09fd3d48',
				'Note not accessible for you.',
			);
		}
		//#endregion

		//#region Select reaction
		let reaction = reaction_ ?? FALLBACK_REACTION;

		const ReactionAcceptanceSchema = z
			.enum([
				'likeOnly',
				'likeOnlyForRemote',
				'nonSensitiveOnly',
				'nonSensitiveOnlyForLocalLikeOnlyForRemote',
			])
			.nullable();
		const acceptance = ReactionAcceptanceSchema.parse(note.reactionAcceptance);

		if (acceptance === 'likeOnly') {
			reaction = '❤️';
		} else if (
			(acceptance === 'likeOnlyForRemote' ||
				acceptance === 'nonSensitiveOnlyForLocalLikeOnlyForRemote') &&
			user.host !== null
		) {
			reaction = '❤️';
		} else if (reaction_) {
			const custom = reaction.match(isCustomEmojiRegexp);
			if (custom) {
				const reacterHost = this.utilityService.toPunyNullable(user.host);

				const name = custom[1];
				const emoji = await this.prismaService.client.customEmoji.findFirst({
					where: { host: reacterHost, name },
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
						if (acceptance === 'nonSensitiveOnly' && emoji.isSensitive) {
							reaction = FALLBACK_REACTION;
						}
					} else {
						// リアクションとして使う権限がない
						reaction = FALLBACK_REACTION;
					}
				} else {
					reaction = FALLBACK_REACTION;
				}
			} else {
				reaction = this.normalize(reaction);
			}
		}
		//#endregion

		//#region Create reaction
		const record: NoteReaction = {
			id: this.idService.genId(),
			createdAt: new Date(),
			noteId: note.id,
			userId: user.id,
			reaction,
		};

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
		//#endregion

		//#region Increment reactions count
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
		//#endregion

		//#region Update chart
		if (user.host === null) {
			await this.perUserReactionsChart.update(user, note);
		} else {
			const meta = await this.metaService.fetch();
			if (meta.enableChartsForRemoteUser) {
				await this.perUserReactionsChart.update(user, note);
			}
		}
		//#endregion

		//#region Publish stream
		// カスタム絵文字リアクションだったら絵文字情報も送る
		const decodedReaction = this.reactionDecodeService.decode(reaction);

		const customEmoji =
			decodedReaction.name === undefined
				? null
				: await this.prismaService.client.customEmoji.findFirst({
						where: {
							name: decodedReaction.name,
							host: decodedReaction.host ?? null,
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
							url:
								customEmoji.publicUrl !== ''
									? customEmoji.publicUrl
									: customEmoji.originalUrl,
					  }
					: null,
			userId: user.id,
		});
		//#endregion

		//#region Create Notification
		if (note.userHost === null) {
			await this.notificationService.createNotification(
				note.userId,
				'reaction',
				{
					notifierId: user.id,
					noteId: note.id,
					reaction: reaction,
				},
			);
		}
		//#endregion

		//#region Deliver
		if (this.userEntityUtilService.isLocalUser(user) && !note.localOnly) {
			const content = this.apRendererService.addContext(
				await this.apRendererService.renderLike(record, note),
			);
			const dm = this.apDeliverManagerService.createDeliverManager(
				user,
				content,
			);
			if (note.userHost !== null) {
				const reactee = await this.prismaService.client.user.findUniqueOrThrow({
					where: { id: note.userId },
				});
				if (this.userEntityUtilService.isRemoteUser(reactee)) {
					dm.addDirectRecipe(reactee);
				} else {
					throw new Error();
				}
			}

			if (['public', 'home', 'followers'].includes(note.visibility)) {
				dm.addFollowersRecipe();
			} else if (note.visibility === 'specified') {
				const users = await this.prismaService.client.user.findMany({
					where: { id: { in: note.visibleUserIds } },
				});
				const visibleUsers = note.visibleUserIds
					.map((id) => users.find((user) => user.id === id))
					.filter(isNotUndefined);
				for (const user of visibleUsers) {
					if (this.userEntityUtilService.isRemoteUser(user)) {
						dm.addDirectRecipe(user);
					}
				}
			}

			await dm.execute();
		}
		//#endregion
	}

	private normalize(reaction: string | null): string {
		if (reaction === null) return FALLBACK_REACTION;

		// 文字列タイプのリアクションを絵文字に変換
		const migratedReaction = LEGACY_REACTIONS.get(reaction);
		if (migratedReaction !== undefined) return migratedReaction;

		// Unicode絵文字
		const match = emojiRegex.exec(reaction);
		if (match) {
			// 合字を含む1つの絵文字
			const unicode = match[0];

			// 異体字セレクタ除去
			return unicode.match('\u200d') ? unicode : unicode.replace(/\ufe0f/g, '');
		}

		return FALLBACK_REACTION;
	}
}
