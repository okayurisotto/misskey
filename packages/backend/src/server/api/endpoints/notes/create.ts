import ms from 'ms';
import { In } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import z from 'zod';
import type { User } from '@/models/entities/User.js';
import type {
	UsersRepository,
	NotesRepository,
	BlockingsRepository,
	DriveFilesRepository,
	ChannelsRepository,
	Note,
} from '@/models/index.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import type { Channel } from '@/models/entities/Channel.js';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { DI } from '@/di-symbols.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, uniqueItems } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

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
		noSuchRenoteTarget: {
			message: 'No such renote target.',
			code: 'NO_SUCH_RENOTE_TARGET',
			id: 'b5c90186-4ab0-49c8-9bba-a1f76c282ba4',
		},
		cannotReRenote: {
			message: 'You can not Renote a pure Renote.',
			code: 'CANNOT_RENOTE_TO_A_PURE_RENOTE',
			id: 'fd4cc33e-2a37-48dd-99cc-9b806eb2031a',
		},
		noSuchReplyTarget: {
			message: 'No such reply target.',
			code: 'NO_SUCH_REPLY_TARGET',
			id: '749ee0f6-d3da-459a-bf02-282e2da4292c',
		},
		cannotReplyToPureRenote: {
			message: 'You can not reply to a pure Renote.',
			code: 'CANNOT_REPLY_TO_A_PURE_RENOTE',
			id: '3ac74a84-8fd5-4bb0-870f-01804f82ce15',
		},
		cannotCreateAlreadyExpiredPoll: {
			message: 'Poll is already expired.',
			code: 'CANNOT_CREATE_ALREADY_EXPIRED_POLL',
			id: '04da457d-b083-4055-9082-955525eda5a5',
		},
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'b1653923-5453-4edc-b786-7c4f39bb0bbb',
		},
		youHaveBeenBlocked: {
			message: 'You have been blocked by this user.',
			code: 'YOU_HAVE_BEEN_BLOCKED',
			id: 'b390d7e1-8a5e-46ed-b625-06271cafd3d3',
		},
		noSuchFile: {
			message: 'Some files are not found.',
			code: 'NO_SUCH_FILE',
			id: 'b6992544-63e7-67f0-fa7f-32444b1b5306',
		},
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
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.blockingsRepository)
		private blockingsRepository: BlockingsRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		private noteEntityService: NoteEntityService,
		private noteCreateService: NoteCreateService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let visibleUsers: User[] = [];
			if (ps.visibleUserIds) {
				visibleUsers = await this.usersRepository.findBy({
					id: In(ps.visibleUserIds),
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
				files = await this.driveFilesRepository
					.createQueryBuilder('file')
					.where('file.userId = :userId AND file.id IN (:...fileIds)', {
						userId: me.id,
						fileIds,
					})
					.orderBy('array_position(ARRAY[:...fileIds], "id"::text)')
					.setParameters({ fileIds })
					.getMany();

				if (files.length !== fileIds.length) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			}

			let renote: Note | null = null;
			if (ps.renoteId != null) {
				// Fetch renote to note
				renote = await this.notesRepository.findOneBy({ id: ps.renoteId });

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
					const blockExist = await this.blockingsRepository.exist({
						where: {
							blockerId: renote.userId,
							blockeeId: me.id,
						},
					});
					if (blockExist) {
						throw new ApiError(meta.errors.youHaveBeenBlocked);
					}
				}
			}

			let reply: Note | null = null;
			if (ps.replyId != null) {
				// Fetch reply
				reply = await this.notesRepository.findOneBy({ id: ps.replyId });

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
					const blockExist = await this.blockingsRepository.exist({
						where: {
							blockerId: reply.userId,
							blockeeId: me.id,
						},
					});
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
				channel = await this.channelsRepository.findOneBy({
					id: ps.channelId,
					isArchived: false,
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
			} satisfies z.infer<typeof res>;
		});
	}
}
