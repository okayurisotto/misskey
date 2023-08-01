import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
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
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	local: z.boolean().default(false),
	reply: z.boolean().optional(),
	renote: z.boolean().optional(),
	withFiles: z.boolean().optional(),
	poll: z.boolean().optional(),
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
				.andWhere("note.visibility = 'public'")
				.andWhere('note.localOnly = FALSE')
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			if (ps.local) {
				query.andWhere('note.userHost IS NULL');
			}

			if (ps.reply !== undefined) {
				query.andWhere(
					ps.reply ? 'note.replyId IS NOT NULL' : 'note.replyId IS NULL',
				);
			}

			if (ps.renote !== undefined) {
				query.andWhere(
					ps.renote ? 'note.renoteId IS NOT NULL' : 'note.renoteId IS NULL',
				);
			}

			if (ps.withFiles !== undefined) {
				query.andWhere(
					ps.withFiles ? "note.fileIds != '{}'" : "note.fileIds = '{}'",
				);
			}

			if (ps.poll !== undefined) {
				query.andWhere(
					ps.poll ? 'note.hasPoll = TRUE' : 'note.hasPoll = FALSE',
				);
			}

			// TODO
			//if (bot != undefined) {
			//	query.isBot = bot;
			//}

			const notes = await query.limit(ps.limit).getMany();

			return (await this.noteEntityService.packMany(notes)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
