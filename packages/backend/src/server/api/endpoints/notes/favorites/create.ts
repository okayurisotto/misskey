import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import type { NoteFavoritesRepository } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { DI } from '@/di-symbols.js';
import { AchievementService } from '@/core/AchievementService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['notes', 'favorites'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:favorites',
	limit: {
		duration: ms('1hour'),
		max: 20,
	},
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '6dd26674-e060-4816-909a-45ba3f4da458',
		},
		alreadyFavorited: {
			message: 'The note has already been marked as a favorite.',
			code: 'ALREADY_FAVORITED',
			id: 'a402c12b-34dd-41d2-97d8-4d2ffd96a1a6',
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

		private idService: IdService,
		private getterService: GetterService,
		private achievementService: AchievementService,
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
			const exist = await this.noteFavoritesRepository.exist({
				where: {
					noteId: note.id,
					userId: me.id,
				},
			});

			if (exist) {
				throw new ApiError(meta.errors.alreadyFavorited);
			}

			// Create favorite
			await this.noteFavoritesRepository.insert({
				id: this.idService.genId(),
				createdAt: new Date(),
				noteId: note.id,
				userId: me.id,
			});

			if (note.userHost == null && note.userId !== me.id) {
				this.achievementService.create(note.userId, 'myNoteFavorited1');
			}
		});
	}
}
