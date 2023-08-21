import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { unavailable_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { SearchService } from '@/core/SearchService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
	errors: { unavailable: unavailable_ },
} as const;

export const paramDef = z
	.object({
		query: z.string(),
		limit: limit({ max: 100, default: 10 }),
		offset: z.number().int().default(0),
		host: z
			.string()
			.optional()
			.describe('The local host is represented with `.`.'),
		userId: MisskeyIdSchema.nullable().default(null),
		channelId: MisskeyIdSchema.nullable().default(null),
	})
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private noteEntityService: NoteEntityService,
		private searchService: SearchService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(
				me ? me.id : null,
			);
			if (!policies.canSearchNotes) {
				throw new ApiError(meta.errors.unavailable);
			}

			const notes = await this.searchService.searchNote(
				ps.query,
				me,
				{
					userId: ps.userId,
					channelId: ps.channelId,
					host: ps.host,
				},
				{
					untilId: ps.untilId,
					sinceId: ps.sinceId,
					limit: ps.limit,
				},
			);

			return (await this.noteEntityService.packMany(
				notes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
