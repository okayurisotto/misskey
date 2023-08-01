import { Inject, Injectable } from '@nestjs/common';
import z from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	noteId: misskeyIdPattern,
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private noteEntityService: NoteEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.notesRepository.createQueryBuilder('note'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('note.replyId = :replyId', { replyId: ps.noteId })
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			this.queryService.generateVisibilityQuery(query, me);
			if (me) this.queryService.generateMutedUserQuery(query, me);
			if (me) this.queryService.generateBlockedUserQuery(query, me);

			const timeline = await query.limit(ps.limit).getMany();

			return (await this.noteEntityService.packMany(
				timeline,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
