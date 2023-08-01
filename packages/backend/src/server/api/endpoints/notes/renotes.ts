import { Inject, Injectable } from '@nestjs/common';
import z from 'zod';
import type { NotesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '12908022-2e21-46cd-ba6a-3edaf6093f46',
		},
	},
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
		private getterService: GetterService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			const query = this.queryService
				.makePaginationQuery(
					this.notesRepository.createQueryBuilder('note'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('note.renoteId = :renoteId', { renoteId: note.id })
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			this.queryService.generateVisibilityQuery(query, me);
			if (me) this.queryService.generateMutedUserQuery(query, me);
			if (me) this.queryService.generateBlockedUserQuery(query, me);

			const renotes = await query.limit(ps.limit).getMany();

			return (await this.noteEntityService.packMany(
				renotes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
