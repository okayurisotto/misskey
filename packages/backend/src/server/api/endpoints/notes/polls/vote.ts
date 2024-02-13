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
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueueService } from '@/core/QueueService.js';
import { PollService } from '@/core/PollService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserBlockingCheckService } from '@/core/UserBlockingCheckService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
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
		private readonly apRendererService: ApRendererService,
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly pollService: PollService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userBlockingCheckService: UserBlockingCheckService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const createdAt = new Date();

			const note = await this.prismaService.client.note.findUnique({
				where: { id: ps.noteId, hasPoll: true },
				include: {
					user: true,
					poll: {
						where: {
							OR: [{ expiresAt: null }, { expiresAt: { lt: createdAt } }],
						},
					},
				},
			});
			if (note === null) throw new ApiError(meta.errors.noSuchNote);
			if (note.poll === null) throw new ApiError(meta.errors.noPoll);

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

			if (note.poll.choices.at(ps.choice) === undefined) {
				throw new ApiError(meta.errors.invalidChoice);
			}

			// if already voted
			const exist = await this.prismaService.client.pollVote.findMany({
				where: { noteId: note.id, userId: me.id },
			});

			if (exist.length) {
				if (note.poll.multiple) {
					if (exist.some((x) => x.choice === ps.choice)) {
						throw new ApiError(meta.errors.alreadyVoted);
					}
				} else {
					throw new ApiError(meta.errors.alreadyVoted);
				}
			}

			// Create vote
			const vote = await this.prismaService.client.pollVote.create({
				data: {
					id: this.idService.genId(),
					createdAt,
					noteId: note.id,
					userId: me.id,
					choice: ps.choice,
				},
			});

			// Increment votes count
			await this.prismaService.client.poll.update({
				where: { noteId: note.poll.noteId },
				data: {
					votes: note.poll.votes.map((v, i) => (i === ps.choice ? v + 1 : v)),
				},
			});

			this.globalEventService.publishNoteStream(note.id, 'pollVoted', {
				choice: ps.choice,
				userId: me.id,
			});

			// リモート投票の場合リプライ送信
			if (this.userEntityUtilService.isRemoteUser(note.user)) {
				await this.queueService.deliver(
					me,
					this.apRendererService.addContext(
						this.apRendererService.renderVote(
							me,
							vote,
							note,
							note.poll,
							note.user,
						),
					),
					note.user.inbox,
					false,
				);
			}

			// リモートフォロワーにUpdate配信
			await this.pollService.deliverQuestionUpdate(note.id);
		});
	}
}
