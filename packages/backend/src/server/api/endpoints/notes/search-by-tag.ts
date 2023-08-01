import { z } from 'zod';
import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository } from '@/models/index.js';
import { safeForSql } from '@/misc/safe-for-sql.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes', 'hashtags'],
	res,
} as const;

const paramDef_base = z.object({
	reply: z.boolean().nullable().default(null),
	renote: z.boolean().nullable().default(null),
	withFiles: z
		.boolean()
		.default(false)
		.describe('Only show notes that have attached files.'),
	poll: z.boolean().nullable().default(null),
	sinceId: MisskeyIdSchema,
	untilId: MisskeyIdSchema,
	limit: z.number().int().min(1).max(100).default(10),
});
export const paramDef = z.union([
	paramDef_base.merge(
		z.object({
			tag: z.string().min(1),
		}),
	),
	paramDef_base.merge(
		z.object({
			query: z
				.array(z.array(z.string().min(1)).min(1))
				.min(1)
				.describe(
					'The outer arrays are chained with OR, the inner arrays are chained with AND.',
				),
		}),
	),
]);

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
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			this.queryService.generateVisibilityQuery(query, me);
			if (me) this.queryService.generateMutedUserQuery(query, me);
			if (me) this.queryService.generateBlockedUserQuery(query, me);

			try {
				if ('tag' in ps) {
					if (!safeForSql(normalizeForSearch(ps.tag))) {
						throw new Error('Injection');
					}
					query.andWhere(`'{"${normalizeForSearch(ps.tag)}"}' <@ note.tags`);
				} else {
					query.andWhere(
						new Brackets((qb) => {
							for (const tags of ps.query!) {
								qb.orWhere(
									new Brackets((qb) => {
										for (const tag of tags) {
											if (!safeForSql(normalizeForSearch(tag))) {
												throw new Error('Injection');
											}
											qb.andWhere(
												`'{"${normalizeForSearch(tag)}"}' <@ note.tags`,
											);
										}
									}),
								);
							}
						}),
					);
				}
			} catch (e) {
				if (e === 'Injection') return [];
				throw e;
			}

			if (ps.reply != null) {
				if (ps.reply) {
					query.andWhere('note.replyId IS NOT NULL');
				} else {
					query.andWhere('note.replyId IS NULL');
				}
			}

			if (ps.renote != null) {
				if (ps.renote) {
					query.andWhere('note.renoteId IS NOT NULL');
				} else {
					query.andWhere('note.renoteId IS NULL');
				}
			}

			if (ps.withFiles) {
				query.andWhere("note.fileIds != '{}'");
			}

			if (ps.poll != null) {
				if (ps.poll) {
					query.andWhere('note.hasPoll = TRUE');
				} else {
					query.andWhere('note.hasPoll = FALSE');
				}
			}

			// Search notes
			const notes = await query.limit(ps.limit).getMany();

			return (await this.noteEntityService.packMany(
				notes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
