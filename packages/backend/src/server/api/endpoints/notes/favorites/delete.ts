import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { DI } from '@/di-symbols.js';
import type { NoteFavoritesRepository } from '@/models/index.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['notes', 'favorites'],
	requireCredential: true,
	kind: 'write:favorites',
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '80848a2c-398f-4343-baa9-df1d57696c56',
		},
		notFavorited: {
			message: 'You have not marked that note a favorite.',
			code: 'NOT_FAVORITED',
			id: 'b625fc69-635e-45e9-86f4-dbefbef35af5',
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
		@Inject(DI.noteFavoritesRepository)
		private noteFavoritesRepository: NoteFavoritesRepository,

		private getterService: GetterService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			// Get favoritee
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			// if already favorited
			const exist = await this.noteFavoritesRepository.findOneBy({
				noteId: note.id,
				userId: me.id,
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notFavorited);
			}

			// Delete favorite
			await this.noteFavoritesRepository.delete(exist.id);
		});
	}
}
