import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { noSuchNote________, alreadyFavorited_ } from '@/server/api/errors.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { AchievementService } from '@/core/AchievementService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
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
	errors: {noSuchNote:noSuchNote________,alreadyFavorited:alreadyFavorited_},
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly getterService: GetterService,
		private readonly achievementService: AchievementService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Get favoritee
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			// if already favorited
			const exist =
				(await this.prismaService.client.note_favorite.count({
					where: {
						noteId: note.id,
						userId: me.id,
					},
					take: 1,
				})) > 0;

			if (exist) {
				throw new ApiError(meta.errors.alreadyFavorited);
			}

			// Create favorite
			await this.prismaService.client.note_favorite.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					noteId: note.id,
					userId: me.id,
				},
			});

			if (note.userHost == null && note.userId !== me.id) {
				this.achievementService.create(note.userId, 'myNoteFavorited1');
			}
		});
	}
}
