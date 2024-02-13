import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchNote____________________ } from '@/server/api/errors.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],
	requireCredential: true,
	errors: { noSuchNote: noSuchNote____________________ },
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
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			const exist =
				(await this.prismaService.client.promoRead.count({
					where: {
						noteId: note.id,
						userId: me.id,
					},
					take: 1,
				})) > 0;

			if (exist) {
				return;
			}

			await this.prismaService.client.promoRead.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					noteId: note.id,
					userId: me.id,
				},
			});
		});
	}
}
