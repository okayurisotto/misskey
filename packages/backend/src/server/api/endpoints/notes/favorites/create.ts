import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { noSuchNote________, alreadyFavorited_ } from '@/server/api/errors.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AchievementService } from '@/core/AchievementService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

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
		noSuchNote: noSuchNote________,
		alreadyFavorited: alreadyFavorited_,
	},
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
		private readonly achievementService: AchievementService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const favorite = await this.prismaService.client.noteFavorite.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					noteId: ps.noteId,
					userId: me.id,
				},
				include: { note: true },
			});

			if (favorite.note.userHost === null && favorite.note.userId !== me.id) {
				await this.achievementService.create(
					favorite.note.userId,
					'myNoteFavorited1',
				);
			}
		});
	}
}
