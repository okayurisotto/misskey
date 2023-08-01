import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { In } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { ClipNotesRepository, ClipsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(ClipSchema);
export const meta = {
	tags: ['clips', 'notes'],
	requireCredential: false,
	res: generateSchema(res),
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '47db1a1c-b0af-458d-8fb4-986e4efafe1e',
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
	typeof res
> {
	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		@Inject(DI.clipNotesRepository)
		private clipNotesRepository: ClipNotesRepository,

		private clipEntityService: ClipEntityService,
		private getterService: GetterService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24')
					throw new ApiError(meta.errors.noSuchNote);
				throw err;
			});

			const clipNotes = await this.clipNotesRepository.findBy({
				noteId: note.id,
			});

			const clips = await this.clipsRepository.findBy({
				id: In(clipNotes.map((x) => x.clipId)),
				isPublic: true,
			});

			return (await this.clipEntityService.packMany(
				clips,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
