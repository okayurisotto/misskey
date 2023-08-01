import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { NotesRepository, DriveFilesRepository } from '@/models/index.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { ApiError } from '../../../error.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['drive', 'notes'],
	requireCredential: true,
	kind: 'read:drive',
	description: 'Find the notes to which the given file is attached.',
	res,
	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'c118ece3-2e4b-4296-99d1-51756e32d232',
		},
	},
} as const;

export const paramDef = z.object({
	fileId: misskeyIdPattern,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private noteEntityService: NoteEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch file
			const file = await this.driveFilesRepository.findOneBy({
				id: ps.fileId,
				userId: me.id,
			});

			if (file == null) {
				throw new ApiError(meta.errors.noSuchFile);
			}

			const notes = await this.notesRepository
				.createQueryBuilder('note')
				.where(':file = ANY(note.fileIds)', { file: file.id })
				.getMany();

			return (await this.noteEntityService.packMany(notes, me, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
