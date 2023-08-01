import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { MetaService } from '@/core/MetaService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '../../error.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	res: generateSchema(res),
	errors: {
		ltlDisabled: {
			message: 'Local timeline has been disabled.',
			code: 'LTL_DISABLED',
			id: '45a6eb02-7695-4393-b023-dd3be9aaaefd',
		},
	},
} as const;

const paramDef_ = z.object({
	withFiles: z.boolean().default(false),
	withReplies: z.boolean().default(false),
	fileType: z.array(z.string()).optional(),
	excludeNsfw: z.boolean().default(false),
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
	sinceDate: z.number().int().optional(),
	untilDate: z.number().int().optional(),
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
		private metaService: MetaService,
		private roleService: RoleService,
		private activeUsersChart: ActiveUsersChart,
		private idService: IdService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(
				me ? me.id : null,
			);
			if (!policies.ltlAvailable) {
				throw new ApiError(meta.errors.ltlDisabled);
			}

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
				.andWhere("(note.visibility = 'public') AND (note.userHost IS NULL)")
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			this.queryService.generateChannelQuery(query, me);
			this.queryService.generateRepliesQuery(query, ps.withReplies, me);
			this.queryService.generateVisibilityQuery(query, me);
			if (me) this.queryService.generateMutedUserQuery(query, me);
			if (me) this.queryService.generateMutedNoteQuery(query, me);
			if (me) this.queryService.generateBlockedUserQuery(query, me);
			if (me) {
				this.queryService.generateMutedUserRenotesQueryForNotes(query, me);
			}
			if (ps.withFiles) {
				query.andWhere("note.fileIds != '{}'");
			}

			if (ps.fileType != null) {
				query.andWhere("note.fileIds != '{}'");
				query.andWhere(
					new Brackets((qb) => {
						for (const type of ps.fileType!) {
							const i = ps.fileType!.indexOf(type);
							qb.orWhere(`:type${i} = ANY(note.attachedFileTypes)`, {
								[`type${i}`]: type,
							});
						}
					}),
				);

				if (ps.excludeNsfw) {
					query.andWhere('note.cw IS NULL');
					query.andWhere(
						'0 = (SELECT COUNT(*) FROM drive_file df WHERE df.id = ANY(note."fileIds") AND df."isSensitive" = TRUE)',
					);
				}
			}
			//#endregion

			const timeline = await query.limit(ps.limit).getMany();

			process.nextTick(() => {
				if (me) {
					this.activeUsersChart.read(me);
				}
			});

			return (await this.noteEntityService.packMany(
				timeline,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
