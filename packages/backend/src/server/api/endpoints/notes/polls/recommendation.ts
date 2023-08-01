import { z } from 'zod';
import { Brackets, In } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type {
	NotesRepository,
	MutingsRepository,
	PollsRepository,
	PollVotesRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	offset: z.number().int().default(0),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

		@Inject(DI.pollVotesRepository)
		private pollVotesRepository: PollVotesRepository,

		@Inject(DI.mutingsRepository)
		private mutingsRepository: MutingsRepository,

		private noteEntityService: NoteEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.pollsRepository
				.createQueryBuilder('poll')
				.where('poll.userHost IS NULL')
				.andWhere('poll.userId != :meId', { meId: me.id })
				.andWhere("poll.noteVisibility = 'public'")
				.andWhere(
					new Brackets((qb) => {
						qb.where('poll.expiresAt IS NULL').orWhere(
							'poll.expiresAt > :now',
							{ now: new Date() },
						);
					}),
				);

			//#region exclude arleady voted polls
			const votedQuery = this.pollVotesRepository
				.createQueryBuilder('vote')
				.select('vote.noteId')
				.where('vote.userId = :meId', { meId: me.id });

			query.andWhere(`poll.noteId NOT IN (${votedQuery.getQuery()})`);

			query.setParameters(votedQuery.getParameters());
			//#endregion

			//#region mute
			const mutingQuery = this.mutingsRepository
				.createQueryBuilder('muting')
				.select('muting.muteeId')
				.where('muting.muterId = :muterId', { muterId: me.id });

			query.andWhere(`poll.userId NOT IN (${mutingQuery.getQuery()})`);

			query.setParameters(mutingQuery.getParameters());
			//#endregion

			const polls = await query
				.orderBy('poll.noteId', 'DESC')
				.limit(ps.limit)
				.offset(ps.offset)
				.getMany();

			if (polls.length === 0) return [];

			const notes = await this.notesRepository.find({
				where: {
					id: In(polls.map((poll) => poll.noteId)),
				},
				order: {
					createdAt: 'DESC',
				},
			});

			return (await this.noteEntityService.packMany(notes, me, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
