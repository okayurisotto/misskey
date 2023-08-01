import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import z from 'zod';
import type { NotesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	noteId: misskeyIdPattern,
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
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

		private noteEntityService: NoteEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.notesRepository.createQueryBuilder('note'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere(
					new Brackets((qb) => {
						qb.where('note.replyId = :noteId', { noteId: ps.noteId }).orWhere(
							new Brackets((qb) => {
								qb.where('note.renoteId = :noteId', {
									noteId: ps.noteId,
								}).andWhere(
									new Brackets((qb) => {
										qb.where('note.text IS NOT NULL')
											.orWhere("note.fileIds != '{}'")
											.orWhere('note.hasPoll = TRUE');
									}),
								);
							}),
						);
					}),
				)
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			this.queryService.generateVisibilityQuery(query, me);
			if (me) {
				this.queryService.generateMutedUserQuery(query, me);
				this.queryService.generateBlockedUserQuery(query, me);
			}

			const notes = await query.limit(ps.limit).getMany();

			return (await this.noteEntityService.packMany(
				notes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
