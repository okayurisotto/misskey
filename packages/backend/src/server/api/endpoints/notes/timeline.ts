import { z } from 'zod';
import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository, FollowingsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	sinceDate: z.number().int().optional(),
	untilDate: z.number().int().optional(),
	includeMyRenotes: z.boolean().default(true),
	includeRenotedMyNotes: z.boolean().default(true),
	includeLocalRenotes: z.boolean().default(true),
	withFiles: z.boolean().default(false),
	withReplies: z.boolean().default(false),
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

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		private noteEntityService: NoteEntityService,
		private queryService: QueryService,
		private activeUsersChart: ActiveUsersChart,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const followees = await this.followingsRepository
				.createQueryBuilder('following')
				.select('following.followeeId')
				.where('following.followerId = :followerId', { followerId: me.id })
				.getMany();

			//#region Construct query
			const query = this.queryService
				.makePaginationQuery(
					this.notesRepository.createQueryBuilder('note'),
					ps.sinceId,
					ps.untilId,
					ps.sinceDate,
					ps.untilDate,
				)
				.andWhere('note.id > :minId', {
					minId: this.idService.genId(
						new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
					),
				}) // 10日前まで
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			if (followees.length > 0) {
				const meOrFolloweeIds = [me.id, ...followees.map((f) => f.followeeId)];

				query.andWhere('note.userId IN (:...meOrFolloweeIds)', {
					meOrFolloweeIds: meOrFolloweeIds,
				});
			} else {
				query.andWhere('note.userId = :meId', { meId: me.id });
			}

			this.queryService.generateChannelQuery(query, me);
			this.queryService.generateRepliesQuery(query, ps.withReplies, me);
			this.queryService.generateVisibilityQuery(query, me);
			this.queryService.generateMutedUserQuery(query, me);
			this.queryService.generateMutedNoteQuery(query, me);
			this.queryService.generateBlockedUserQuery(query, me);
			this.queryService.generateMutedUserRenotesQueryForNotes(query, me);

			if (ps.includeMyRenotes === false) {
				query.andWhere(
					new Brackets((qb) => {
						qb.orWhere('note.userId != :meId', { meId: me.id });
						qb.orWhere('note.renoteId IS NULL');
						qb.orWhere('note.text IS NOT NULL');
						qb.orWhere("note.fileIds != '{}'");
						qb.orWhere(
							'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
						);
					}),
				);
			}

			if (ps.includeRenotedMyNotes === false) {
				query.andWhere(
					new Brackets((qb) => {
						qb.orWhere('note.renoteUserId != :meId', { meId: me.id });
						qb.orWhere('note.renoteId IS NULL');
						qb.orWhere('note.text IS NOT NULL');
						qb.orWhere("note.fileIds != '{}'");
						qb.orWhere(
							'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
						);
					}),
				);
			}

			if (ps.includeLocalRenotes === false) {
				query.andWhere(
					new Brackets((qb) => {
						qb.orWhere('note.renoteUserHost IS NOT NULL');
						qb.orWhere('note.renoteId IS NULL');
						qb.orWhere('note.text IS NOT NULL');
						qb.orWhere("note.fileIds != '{}'");
						qb.orWhere(
							'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
						);
					}),
				);
			}

			if (ps.withFiles) {
				query.andWhere("note.fileIds != '{}'");
			}
			//#endregion

			const timeline = await query.limit(ps.limit).getMany();

			process.nextTick(() => {
				this.activeUsersChart.read(me);
			});

			return (await this.noteEntityService.packMany(
				timeline,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
