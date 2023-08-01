import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type {
	NotesRepository,
	NoteThreadMutingsRepository,
	NoteFavoritesRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.object({
	isFavorited: z.boolean(),
	isMutedThread: z.boolean(),
});
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	res,
} as const;

export const paramDef = z.object({
	noteId: misskeyIdPattern,
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

		@Inject(DI.noteThreadMutingsRepository)
		private noteThreadMutingsRepository: NoteThreadMutingsRepository,

		@Inject(DI.noteFavoritesRepository)
		private noteFavoritesRepository: NoteFavoritesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.notesRepository.findOneByOrFail({
				id: ps.noteId,
			});

			const [favorite, threadMuting] = await Promise.all([
				this.noteFavoritesRepository.count({
					where: {
						userId: me.id,
						noteId: note.id,
					},
					take: 1,
				}),
				this.noteThreadMutingsRepository.count({
					where: {
						userId: me.id,
						threadId: note.threadId ?? note.id,
					},
					take: 1,
				}),
			]);

			return {
				isFavorited: favorite !== 0,
				isMutedThread: threadMuting !== 0,
			} satisfies z.infer<typeof res>;
		});
	}
}
