import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository, NotesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],
	requireCredential: true,
	kind: 'write:notes',
	limit: {
		duration: ms('1hour'),
		max: 300,
		minInterval: ms('1sec'),
	},
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: 'efd4a259-2442-496b-8dd7-b255aa1a160f',
		},
	},
} as const;

const paramDef_ = z.object({
	noteId: misskeyIdPattern,
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private getterService: GetterService,
		private noteDeleteService: NoteDeleteService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			const renotes = await this.notesRepository.findBy({
				userId: me.id,
				renoteId: note.id,
			});

			for (const note of renotes) {
				this.noteDeleteService.delete(
					await this.usersRepository.findOneByOrFail({ id: me.id }),
					note,
				);
			}
		});
	}
}
