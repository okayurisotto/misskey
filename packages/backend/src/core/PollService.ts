import { Injectable } from '@nestjs/common';
import { RelayService } from '@/core/RelayService.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { note, user } from '@prisma/client';

@Injectable()
export class PollService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly relayService: RelayService,
		private readonly globalEventService: GlobalEventService,
		private readonly userBlockingService: UserBlockingService,
		private readonly apRendererService: ApRendererService,
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly prismaService: PrismaService,
	) {}

	public async vote(user: user, note: note, choice: number): Promise<void> {
		const poll = await this.prismaService.client.poll.findUnique({ where: { noteId: note.id } });

		if (poll == null) throw new Error('poll not found');

		// Check whether is valid choice
		if (poll.choices[choice] == null) throw new Error('invalid choice param');

		// Check blocking
		if (note.userId !== user.id) {
			const blocked = await this.userBlockingService.checkBlocked(note.userId, user.id);
			if (blocked) {
				throw new Error('blocked');
			}
		}

		// if already voted
		const exist = await this.prismaService.client.poll_vote.findMany({
			where: {
				noteId: note.id,
				userId: user.id,
			},
		});

		if (poll.multiple) {
			if (exist.some(x => x.choice === choice)) {
				throw new Error('already voted');
			}
		} else if (exist.length !== 0) {
			throw new Error('already voted');
		}

		// Create vote
		await this.prismaService.client.poll_vote.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				noteId: note.id,
				userId: user.id,
				choice: choice,
			},
		});

		this.prismaService.client.$transaction(async (client) => {
			const data = await client.poll.findUniqueOrThrow({
				where: { noteId: poll.noteId },
			});

			await client.poll.update({
				where: { noteId: poll.noteId },
				data: {
					votes: data.votes.map((vote, index) => {
						if (index !== choice) return vote;
						return vote + 1;
					}),
				},
			});
		});

		this.globalEventService.publishNoteStream(note.id, 'pollVoted', {
			choice: choice,
			userId: user.id,
		});
	}

	public async deliverQuestionUpdate(noteId: note['id']): Promise<void> {
		const note = await this.prismaService.client.note.findUnique({ where: { id: noteId } });
		if (note == null) throw new Error('note not found');

		const user = await this.prismaService.client.user.findUnique({ where: { id: note.userId } });
		if (user == null) throw new Error('note not found');

		if (this.userEntityService.isLocalUser(user)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderUpdate(await this.apRendererService.renderNote(note, false), user));
			this.apDeliverManagerService.deliverToFollowers(user, content);
			this.relayService.deliverToRelays(user, content);
		}
	}
}
