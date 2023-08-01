import { Inject, Injectable } from '@nestjs/common';
import z from 'zod';
import type { NoteReactionsRepository } from '@/models/index.js';
import type { NoteReaction } from '@/models/entities/NoteReaction.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteReactionEntityService } from '@/core/entities/NoteReactionEntityService.js';
import { DI } from '@/di-symbols.js';
import { NoteReactionSchema } from '@/models/zod/NoteReactionSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import type { FindOptionsWhere } from 'typeorm';

const res = z.array(NoteReactionSchema);
export const meta = {
	tags: ['notes', 'reactions'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 60,
	res,
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '263fff3d-d0e1-4af4-bea7-8408059b451a',
		},
	},
} as const;

export const paramDef = z.object({
	noteId: misskeyIdPattern,
	type: z.string().nullable().optional(),
	limit: z.number().int().min(1).max(100).default(10),
	offset: z.number().int().default(0),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.noteReactionsRepository)
		private noteReactionsRepository: NoteReactionsRepository,

		private noteReactionEntityService: NoteReactionEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = {
				noteId: ps.noteId,
			} as FindOptionsWhere<NoteReaction>;

			if (ps.type) {
				// ローカルリアクションはホスト名が . とされているが
				// DB 上ではそうではないので、必要に応じて変換
				const suffix = '@.:';
				const type = ps.type.endsWith(suffix)
					? ps.type.slice(0, ps.type.length - suffix.length) + ':'
					: ps.type;
				query.reaction = type;
			}

			const reactions = await this.noteReactionsRepository.find({
				where: query,
				take: ps.limit,
				skip: ps.offset,
				order: {
					id: -1,
				},
				relations: ['user', 'note'],
			});

			return (await Promise.all(
				reactions.map((reaction) =>
					this.noteReactionEntityService.pack(reaction, me),
				),
			)) satisfies z.infer<typeof res>;
		});
	}
}
