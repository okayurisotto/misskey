import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository, FollowingsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteReadService } from '@/core/NoteReadService.js';
import { DI } from '@/di-symbols.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	following: z.boolean().default(false),
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
	visibility: z.string().optional(),
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

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private noteEntityService: NoteEntityService,
		private queryService: QueryService,
		private noteReadService: NoteReadService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const followingQuery = this.followingsRepository
				.createQueryBuilder('following')
				.select('following.followeeId')
				.where('following.followerId = :followerId', { followerId: me.id });

			const query = this.queryService
				.makePaginationQuery(
					this.notesRepository.createQueryBuilder('note'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere(
					new Brackets((qb) => {
						qb.where(`'{"${me.id}"}' <@ note.mentions`).orWhere(
							`'{"${me.id}"}' <@ note.visibleUserIds`,
						);
					}),
				)
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			this.queryService.generateVisibilityQuery(query, me);
			this.queryService.generateMutedUserQuery(query, me);
			this.queryService.generateMutedNoteThreadQuery(query, me);
			this.queryService.generateBlockedUserQuery(query, me);

			if (ps.visibility) {
				query.andWhere('note.visibility = :visibility', {
					visibility: ps.visibility,
				});
			}

			if (ps.following) {
				query.andWhere(
					`((note.userId IN (${followingQuery.getQuery()})) OR (note.userId = :meId))`,
					{ meId: me.id },
				);
				query.setParameters(followingQuery.getParameters());
			}

			const mentions = await query.limit(ps.limit).getMany();

			this.noteReadService.read(me.id, mentions);

			return (await this.noteEntityService.packMany(
				mentions,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
