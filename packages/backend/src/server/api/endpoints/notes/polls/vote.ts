import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	noSuchNote__________,
	noPoll,
	invalidChoice,
	alreadyVoted,
	alreadyExpired,
	youHaveBeenBlocked_,
} from '@/server/api/errors.js';
import type { RemoteUser } from '@/models/entities/User.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { QueueService } from '@/core/QueueService.js';
import { PollService } from '@/core/PollService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserBlockingCheckService } from '@/core/UserBlockingCheckService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['notes'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:votes',
	errors: {
		noSuchNote: noSuchNote__________,
		noPoll: noPoll,
		invalidChoice: invalidChoice,
		alreadyVoted: alreadyVoted,
		alreadyExpired: alreadyExpired,
		youHaveBeenBlocked: youHaveBeenBlocked_,
	},
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
	choice: z.number().int(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly getterService: GetterService,
		private readonly queueService: QueueService,
		private readonly pollService: PollService,
		private readonly apRendererService: ApRendererService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
		private readonly userBlockingCheckService: UserBlockingCheckService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const createdAt = new Date();

			// Get votee
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			if (!note.hasPoll) {
				throw new ApiError(meta.errors.noPoll);
			}

			// Check blocking
			if (note.userId !== me.id) {
				const blocked = await this.userBlockingCheckService.check(
					note.userId,
					me.id,
				);
				if (blocked) {
					throw new ApiError(meta.errors.youHaveBeenBlocked);
				}
			}

			const poll = await this.prismaService.client.poll.findUniqueOrThrow({
				where: { noteId: note.id },
			});

			if (poll.expiresAt && poll.expiresAt < createdAt) {
				throw new ApiError(meta.errors.alreadyExpired);
			}

			if (poll.choices[ps.choice] == null) {
				throw new ApiError(meta.errors.invalidChoice);
			}

			// if already voted
			const exist = await this.prismaService.client.poll_vote.findMany({
				where: {
					noteId: note.id,
					userId: me.id,
				},
			});

			if (exist.length) {
				if (poll.multiple) {
					if (exist.some((x) => x.choice === ps.choice)) {
						throw new ApiError(meta.errors.alreadyVoted);
					}
				} else {
					throw new ApiError(meta.errors.alreadyVoted);
				}
			}

			// Create vote
			const vote = await this.prismaService.client.poll_vote.create({
				data: {
					id: this.idService.genId(),
					createdAt,
					noteId: note.id,
					userId: me.id,
					choice: ps.choice,
				},
			});

			// Increment votes count
			const votes = (
				await this.prismaService.client.poll.findUniqueOrThrow({
					where: { noteId: poll.noteId },
					select: { votes: true },
				})
			).votes;
			await this.prismaService.client.poll.update({
				where: { noteId: poll.noteId },
				data: { votes: votes.map((v, i) => (i === ps.choice ? v + 1 : v)) },
			});

			this.globalEventService.publishNoteStream(note.id, 'pollVoted', {
				choice: ps.choice,
				userId: me.id,
			});

			// リモート投票の場合リプライ送信
			if (note.userHost != null) {
				const pollOwner =
					(await this.prismaService.client.user.findUniqueOrThrow({
						where: { id: note.userId },
					})) as RemoteUser;

				this.queueService.deliver(
					me,
					this.apRendererService.addContext(
						this.apRendererService.renderVote(me, vote, note, poll, pollOwner),
					),
					pollOwner.inbox,
					false,
				);
			}

			// リモートフォロワーにUpdate配信
			this.pollService.deliverQuestionUpdate(note.id);
		});
	}
}
