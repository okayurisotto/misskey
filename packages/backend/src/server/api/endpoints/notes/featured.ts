import { z } from 'zod';
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
	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	offset: z.number().int().default(0),
	channelId: misskeyIdPattern.optional(),
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
			const day = 1000 * 60 * 60 * 24 * 3; // 3日前まで

			const query = this.notesRepository
				.createQueryBuilder('note')
				.addSelect('note.score')
				.where('note.userHost IS NULL')
				.andWhere('note.score > 0')
				.andWhere('note.createdAt > :date', {
					date: new Date(Date.now() - day),
				})
				.andWhere("note.visibility = 'public'")
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			if (ps.channelId) {
				query.andWhere('note.channelId = :channelId', {
					channelId: ps.channelId,
				});
			}

			if (me) this.queryService.generateMutedUserQuery(query, me);
			if (me) this.queryService.generateBlockedUserQuery(query, me);

			let notes = await query
				.orderBy('note.score', 'DESC')
				.limit(100)
				.getMany();

			notes.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			notes = notes.slice(ps.offset, ps.offset + ps.limit);

			return (await this.noteEntityService.packMany(
				notes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
