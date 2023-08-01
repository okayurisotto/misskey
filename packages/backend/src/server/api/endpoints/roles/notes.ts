import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { NotesRepository, RolesRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { IdService } from '@/core/IdService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['role', 'notes'],
	requireCredential: true,
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: 'eb70323a-df61-4dd4-ad90-89c83c7cf26e',
		},
	},
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	roleId: misskeyIdPattern,
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
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.rolesRepository)
		private rolesRepository: RolesRepository,

		private idService: IdService,
		private noteEntityService: NoteEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const role = await this.rolesRepository.findOneBy({
				id: ps.roleId,
				isPublic: true,
			});

			if (role == null) {
				throw new ApiError(meta.errors.noSuchRole);
			}
			if (!role.isExplorable) {
				return [];
			}
			const limit = ps.limit + (ps.untilId ? 1 : 0) + (ps.sinceId ? 1 : 0); // untilIdに指定したものも含まれるため+1
			const noteIdsRes = await this.redisClient.xrevrange(
				`roleTimeline:${role.id}`,
				ps.untilId
					? this.idService.parse(ps.untilId).date.getTime()
					: ps.untilDate ?? '+',
				ps.sinceId
					? this.idService.parse(ps.sinceId).date.getTime()
					: ps.sinceDate ?? '-',
				'COUNT',
				limit,
			);

			if (noteIdsRes.length === 0) {
				return [];
			}

			const noteIds = noteIdsRes
				.map((x) => x[1][1])
				.filter((x) => x !== ps.untilId && x !== ps.sinceId);

			if (noteIds.length === 0) {
				return [];
			}

			const query = this.notesRepository
				.createQueryBuilder('note')
				.where('note.id IN (:...noteIds)', { noteIds: noteIds })
				.andWhere("(note.visibility = 'public')")
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser');

			this.queryService.generateVisibilityQuery(query, me);
			this.queryService.generateMutedUserQuery(query, me);
			this.queryService.generateBlockedUserQuery(query, me);

			const notes = await query.getMany();
			notes.sort((a, b) => (a.id > b.id ? -1 : 1));

			return (await this.noteEntityService.packMany(
				notes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
