import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { SearchService } from '@/core/SearchService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
	errors: {
		unavailable: {
			message: 'Search of notes unavailable.',
			code: 'UNAVAILABLE',
			id: '0b44998d-77aa-4427-80d0-d2c9b8523011',
		},
	},
} as const;

export const paramDef = z.object({
	query: z.string(),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
	limit: z.number().int().min(1).max(100).default(10),
	offset: z.number().int().default(0),
	host: z
		.string()
		.optional()
		.describe('The local host is represented with `.`.'),
	userId: misskeyIdPattern.nullable().default(null),
	channelId: misskeyIdPattern.nullable().default(null),
});

// TODO: ロジックをサービスに切り出す

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
