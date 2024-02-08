import ms from 'ms';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import {
	noSuchRenoteTarget,
	cannotReRenote,
	noSuchReplyTarget,
	cannotReplyToPureRenote,
	cannotCreateAlreadyExpiredPoll,
	noSuchChannel_______,
	youHaveBeenBlocked,
	noSuchFile______________,
} from '@/server/api/errors.js';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, uniqueItems } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';
import type { Channel, DriveFile, note, user } from '@prisma/client';

const res = z.object({ createdNote: NoteSchema });
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	prohibitMoved: true,
	limit: {
		duration: ms('1hour'),
		max: 300,
	},
	kind: 'write:notes',
	res,
	errors: {
		noSuchRenoteTarget: noSuchRenoteTarget,
		cannotReRenote: cannotReRenote,
		noSuchReplyTarget: noSuchReplyTarget,
		cannotReplyToPureRenote: cannotReplyToPureRenote,
		cannotCreateAlreadyExpiredPoll: cannotCreateAlreadyExpiredPoll,
		noSuchChannel: noSuchChannel_______,
		youHaveBeenBlocked: youHaveBeenBlocked,
		noSuchFile: noSuchFile______________,
	},
} as const;

const paramDef_fileIds = uniqueItems(z.array(MisskeyIdSchema).min(1).max(16));
const paramDef_mediaIds = uniqueItems(z.array(MisskeyIdSchema).min(1).max(16));
const paramDef_poll = z.object({
	choices: uniqueItems(z.array(z.string().min(1).max(50)).min(2).max(10)),
	expiredAfter: z.number().int().min(1).nullable().optional(),
	expiresAt: z.number().int().nullable().optional(),
	multiple: z.boolean().optional(),
});
const paramDef_renoteId = MisskeyIdSchema;
const paramDef_text = z.string().min(1).max(MAX_NOTE_TEXT_LENGTH);
const paramDef_base = z.object({
	channelId: MisskeyIdSchema.nullable().optional(),
	cw: z.string().max(100).nullable().optional(),
	localOnly: z.boolean().default(false),
	noExtractEmojis: z.boolean().default(false),
	noExtractHashtags: z.boolean().default(false),
	noExtractMentions: z.boolean().default(false),
	reactionAcceptance: z
		.enum([
			'likeOnly',
			'likeOnlyForRemote',
			'nonSensitiveOnly',
			'nonSensitiveOnlyForLocalLikeOnlyForRemote',
		])
		.nullable()
		.default(null),
	replyId: MisskeyIdSchema.nullable().optional(),
	visibility: z
		.enum(['followers', 'home', 'public', 'specified'])
		.default('public'),
	visibleUserIds: uniqueItems(z.array(MisskeyIdSchema)).optional(),
	...{
		fileIds: paramDef_fileIds.optional(),
		mediaIds: paramDef_mediaIds.optional(),
		poll: paramDef_poll.nullable().optional(),
		renoteId: paramDef_renoteId.nullable().optional(),
		text: paramDef_text.optional(),
	},
});
export const paramDef = z.union([
	paramDef_base.extend({ fileIds: paramDef_fileIds }),
	paramDef_base.extend({ mediaIds: paramDef_mediaIds }),
	paramDef_base.extend({ poll: paramDef_poll }),
	paramDef_base.extend({ renoteId: paramDef_renoteId }),
	paramDef_base.extend({ text: paramDef_text }),
]);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly noteEntityService: NoteEntityPackService,
		private readonly noteCreateService: NoteCreateService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let visibleUsers: user[] = [];
			if (ps.visibleUserIds) {
				visibleUsers = await this.prismaService.client.user.findMany({
					where: { id: { in: ps.visibleUserIds } },
				});
			}

			let files: DriveFile[] = [];
			const fileIds =
				ps.fileIds != null
					? ps.fileIds
					: ps.mediaIds != null
					? ps.mediaIds
					: null;
			if (fileIds != null) {
				files = (
					await this.prismaService.client.driveFile.findMany({
						where: { userId: me.id, id: { in: fileIds } },
					})
				).sort(({ id: a }, { id: b }) => {
					return (
						fileIds.findIndex((id) => id === a) -
						fileIds.findIndex((id) => id === b)
					);
				});

				if (files.length !== fileIds.length) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			}

			let renote: note | null = null;
			if (ps.renoteId != null) {
				// Fetch renote to note
				renote = await this.prismaService.client.note.findUnique({
					where: { id: ps.renoteId },
				});

				if (renote == null) {
					throw new ApiError(meta.errors.noSuchRenoteTarget);
				} else if (
					renote.renoteId &&
					!renote.text &&
					!renote.fileIds &&
					!renote.hasPoll
				) {
					throw new ApiError(meta.errors.cannotReRenote);
				}

				// Check blocking
				if (renote.userId !== me.id) {
					const blockExist =
						(await this.prismaService.client.blocking.count({
							where: { blockerId: renote.userId, blockeeId: me.id },
							take: 1,
						})) > 0;
					if (blockExist) {
						throw new ApiError(meta.errors.youHaveBeenBlocked);
					}
				}
			}

			let reply: note | null = null;
			if (ps.replyId != null) {
				// Fetch reply
				reply = await this.prismaService.client.note.findUnique({
					where: { id: ps.replyId },
				});

				if (reply == null) {
					throw new ApiError(meta.errors.noSuchReplyTarget);
				} else if (
					reply.renoteId &&
					!reply.text &&
					!reply.fileIds &&
					!reply.hasPoll
				) {
					throw new ApiError(meta.errors.cannotReplyToPureRenote);
				}

				// Check blocking
				if (reply.userId !== me.id) {
					const blockExist =
						(await this.prismaService.client.blocking.count({
							where: {
								blockerId: reply.userId,
								blockeeId: me.id,
							},
							take: 1,
						})) > 0;
					if (blockExist) {
						throw new ApiError(meta.errors.youHaveBeenBlocked);
					}
				}
			}

			if (ps.poll) {
				if (typeof ps.poll.expiresAt === 'number') {
					if (ps.poll.expiresAt < Date.now()) {
						throw new ApiError(meta.errors.cannotCreateAlreadyExpiredPoll);
					}
				} else if (typeof ps.poll.expiredAfter === 'number') {
					ps.poll.expiresAt = Date.now() + ps.poll.expiredAfter;
				}
			}

			let channel: Channel | null = null;
			if (ps.channelId != null) {
				channel = await this.prismaService.client.channel.findUnique({
					where: {
						id: ps.channelId,
						isArchived: false,
					},
				});

				if (channel == null) {
					throw new ApiError(meta.errors.noSuchChannel);
				}
			}

			// 投稿を作成
			const note = await this.noteCreateService.create(me, {
				createdAt: new Date(),
				files: files,
				poll: ps.poll
					? {
							choices: ps.poll.choices,
							multiple: ps.poll.multiple ?? false,
							expiresAt: ps.poll.expiresAt ? new Date(ps.poll.expiresAt) : null,
					  }
					: undefined,
				text: ps.text ?? undefined,
				reply,
				renote,
				cw: ps.cw,
				localOnly: ps.localOnly,
				reactionAcceptance: ps.reactionAcceptance,
				visibility: ps.visibility,
				visibleUsers,
				channel,
				apMentions: ps.noExtractMentions ? [] : undefined,
				apHashtags: ps.noExtractHashtags ? [] : undefined,
				apEmojis: ps.noExtractEmojis ? [] : undefined,
			});

			return {
				createdNote: await this.noteEntityService.pack(note, me),
			};
		});
	}
}
