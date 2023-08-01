import { z } from 'zod';
import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type {
	NotesRepository,
	UserListsRepository,
	UserListJoiningsRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { DI } from '@/di-symbols.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes', 'lists'],
	requireCredential: true,
	res,
	errors: {
		noSuchList: {
			message: 'No such list.',
			code: 'NO_SUCH_LIST',
			id: '8fb1fbd5-e476-4c37-9fb0-43d55b63a2ff',
		},
	},
} as const;

export const paramDef = z.object({
	listId: MisskeyIdSchema,
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	sinceDate: z.number().int().optional(),
	untilDate: z.number().int().optional(),
	includeMyRenotes: z.boolean().default(true),
	includeRenotedMyNotes: z.boolean().default(true),
	includeLocalRenotes: z.boolean().default(true),
	withFiles: z
		.boolean()
		.default(false)
		.describe('Only show notes that have attached files.'),
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

		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		@Inject(DI.userListJoiningsRepository)
		private userListJoiningsRepository: UserListJoiningsRepository,

		private noteEntityService: NoteEntityService,
		private queryService: QueryService,
		private activeUsersChart: ActiveUsersChart,
	) {
		super(meta, paramDef, async (ps, me) => {
			const list = await this.userListsRepository.findOneBy({
				id: ps.listId,
				userId: me.id,
			});

			if (list == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			//#region Construct query
			const query = this.queryService
				.makePaginationQuery(
					this.notesRepository.createQueryBuilder('note'),
					ps.sinceId,
					ps.untilId,
				)
				.innerJoin(
					this.userListJoiningsRepository.metadata.targetName,
					'userListJoining',
					'userListJoining.userId = note.userId',
				)
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser')
				.andWhere('userListJoining.userListId = :userListId', {
					userListId: list.id,
				});

			this.queryService.generateVisibilityQuery(query, me);

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

			this.activeUsersChart.read(me);

			return (await this.noteEntityService.packMany(
				timeline,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
